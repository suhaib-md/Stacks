"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CAMERA_CONSTRAINTS,
  beep,
  createNativeDetector,
  detectSupport,
  enableContinuousFocus,
  focusAtPoint,
  focusSupport,
  rankByCentrality,
  setTorch,
  stopStream,
  supportsTorch,
  vibrate,
  type DetectorKind,
} from "@/lib/scanner/detector";

type Phase =
  | { kind: "checking" }
  | { kind: "requesting" }
  | { kind: "scanning" }
  | { kind: "denied"; message: string }
  | { kind: "unsupported" };

const FALLBACK_ELEMENT_ID = "stacks-fallback-scanner";
const DETECT_INTERVAL_MS = 100; // ~10 fps — plenty for a barcode, easy on the battery
const SAME_CODE_COOLDOWN_MS = 2500;

export function Scanner({
  paused,
  onDetect,
  onUnsupported,
}: {
  /** True while the confirm sheet is open: stop detecting, keep the stream warm. */
  paused: boolean;
  /**
   * Receives every code found in the frame, centre-most first. Returns true if
   * one of them was accepted and a lookup started.
   */
  onDetect: (rawValues: string[]) => boolean;
  onUnsupported: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pausedRef = useRef(paused);
  const lastCodeRef = useRef<{ value: string; at: number } | null>(null);
  const onDetectRef = useRef(onDetect);
  /**
   * Set synchronously the moment a code is accepted.
   *
   * `paused` can't do this job alone: it travels prop -> render -> effect, and
   * the detect loop keeps ticking during that gap. A DIFFERENT barcode landing
   * in that window (a neighbouring book, a misread) starts a second lookup, and
   * whichever resolves last wins — which is how you scan one book and get
   * another.
   */
  const busyRef = useRef(false);

  const [phase, setPhase] = useState<Phase>({ kind: "checking" });
  const [kind, setKind] = useState<DetectorKind>("unsupported");
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [stalled, setStalled] = useState(false);
  const [tapFocusAvailable, setTapFocusAvailable] = useState(false);
  /** Where to draw the focus ring, in percentages of the video box. */
  const [focusRing, setFocusRing] = useState<{ x: number; y: number } | null>(null);

  // "Starting camera…" forever is the least debuggable failure there is, and it
  // can only be reproduced on a real device. After 8s, say which path we took.
  useEffect(() => {
    if (phase.kind !== "requesting") return;
    const timer = setTimeout(() => setStalled(true), 8000);
    return () => clearTimeout(timer);
  }, [phase.kind]);

  // Fade the focus ring out. Keyed on object identity, so tapping the same spot
  // twice restarts it.
  useEffect(() => {
    if (!focusRing) return;
    const timer = setTimeout(() => setFocusRing(null), 900);
    return () => clearTimeout(timer);
  }, [focusRing]);

  // Keep refs current without restarting the camera when these props change.
  useEffect(() => {
    const wasPaused = pausedRef.current;
    pausedRef.current = paused;

    // Resuming: release the lock and restart the cooldown clock. Without the
    // cooldown reset, the book you just saved is usually still in frame and more
    // than 2.5s has passed during the confirm tap — so it re-detects instantly
    // and you get "already in your library" for the book you just added.
    if (wasPaused && !paused) {
      busyRef.current = false;
      if (lastCodeRef.current) {
        lastCodeRef.current = { ...lastCodeRef.current, at: Date.now() };
      }
    }
  }, [paused]);
  useEffect(() => {
    onDetectRef.current = onDetect;
  }, [onDetect]);

  /** Debounce, forward, and only then confirm. Cameras fire many frames per barcode. */
  const handleCodes = useCallback((rawValues: string[]) => {
    // One lookup at a time, enforced without waiting for a React render.
    if (busyRef.current || rawValues.length === 0) return;

    const now = Date.now();
    const last = lastCodeRef.current;
    // Cooldown applies to the whole candidate set: re-reading the same book's
    // barcode alongside its price add-on must not count as something new.
    const candidates = rawValues.filter(
      (value) => !(last && last.value === value && now - last.at < SAME_CODE_COOLDOWN_MS),
    );
    if (candidates.length === 0) return;

    // Feedback comes AFTER the caller accepts one. Beeping first meant a grocery
    // barcode chirped and then silently did nothing, which reads as a bug.
    const accepted = onDetectRef.current(candidates);
    if (!accepted) return;

    lastCodeRef.current = { value: candidates[0], at: now };
    busyRef.current = true;
    beep();
    vibrate(50);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // Populated only on the fallback path so cleanup can tear it down.
    let fallback: { stop: () => Promise<void> } | null = null;
    // Assigned once we actually attach a stream, and used by cleanup. NOT read
    // from the ref up here: on the first commit the element may not exist yet,
    // and capturing null then silently kills the whole start sequence.
    let attachedVideo: HTMLVideoElement | null = null;

    async function start() {
      const support = await detectSupport();
      if (cancelled) return;

      setKind(support);

      if (support === "unsupported") {
        setPhase({ kind: "unsupported" });
        onUnsupported();
        return;
      }

      setPhase({ kind: "requesting" });

      if (support === "native") {
        try {
          const stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
          if (cancelled) {
            // Permission resolved after we navigated away — release it immediately.
            stopStream(stream);
            return;
          }
          streamRef.current = stream;
          setTorchAvailable(supportsTorch(stream));

          // Some cameras ignore the constraint passed to getUserMedia but accept
          // it applied to the live track, so ask a second time.
          const focus = focusSupport(stream);
          if (focus.continuous) void enableContinuousFocus(stream);
          setTapFocusAvailable(focus.tapToFocus);

          // Read at point of use: by now the awaits above have let React commit
          // the render that mounts the element.
          const video = videoRef.current;
          if (!video) {
            stopStream(stream);
            setPhase({ kind: "denied", message: "The video surface failed to mount." });
            return;
          }
          attachedVideo = video;
          video.srcObject = stream;
          await video.play().catch(() => {});
          if (cancelled) return;

          const detector = createNativeDetector();
          if (!detector) {
            setPhase({ kind: "unsupported" });
            onUnsupported();
            return;
          }

          setPhase({ kind: "scanning" });

          const tick = async () => {
            if (cancelled) return;
            if (!pausedRef.current && video.readyState >= 2) {
              try {
                const codes = await detector.detect(video);
                if (!cancelled && codes.length > 0) {
                  // Pass every code, centre-most first. Taking only codes[0]
                  // meant a price add-on or shop sticker could mask the ISBN
                  // sitting right beside it.
                  handleCodes(
                    rankByCentrality(codes, video.videoWidth, video.videoHeight),
                  );
                }
              } catch {
                // A single failed frame is not worth surfacing; keep scanning.
              }
            }
            if (!cancelled) timer = setTimeout(tick, DETECT_INTERVAL_MS);
          };
          void tick();
        } catch (error) {
          if (cancelled) return;
          setPhase({ kind: "denied", message: describeCameraError(error) });
        }
        return;
      }

      // Fallback: html5-qrcode owns its own stream and video element. Loaded
      // dynamically so devices with native support never download ~300 KB.
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        if (cancelled) return;

        const instance = new Html5Qrcode(FALLBACK_ELEMENT_ID, {
          formatsToSupport: [Html5QrcodeSupportedFormats.EAN_13],
          verbose: false,
        });
        fallback = { stop: async () => { await instance.stop(); instance.clear(); } };

        await instance.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 160 } },
          (decoded) => {
            // The fallback decodes one symbol at a time, so there is only ever
            // one candidate to offer.
            if (!pausedRef.current) handleCodes([decoded]);
          },
          () => {
            // Fires constantly for "no code in this frame". Not an error.
          },
        );
        if (cancelled) return;
        setPhase({ kind: "scanning" });
      } catch (error) {
        if (cancelled) return;
        setPhase({ kind: "denied", message: describeCameraError(error) });
      }
    }

    void start();

    return () => {
      // Runs on unmount AND on route change. Everything acquired above must be
      // released here or the camera light stays on and the battery drains.
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (attachedVideo) attachedVideo.srcObject = null;
      stopStream(streamRef.current);
      streamRef.current = null;
      void fallback?.stop().catch(() => {});
    };
  }, [handleCodes, onUnsupported]);

  async function toggleTorch() {
    const next = !torchOn;
    const ok = await setTorch(streamRef.current, next);
    if (ok) setTorchOn(next);
  }

  /**
   * Tap anywhere on the feed to focus there.
   *
   * The video is `object-fit: cover`, so the element's box and the camera frame
   * are not the same rectangle — the overflowing axis has to be mapped back or
   * the camera focuses somewhere other than where you tapped.
   */
  async function handleFocusTap(event: React.MouseEvent<HTMLDivElement>) {
    const video = videoRef.current;
    if (!video || !tapFocusAvailable) return;

    const rect = video.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const tapX = (event.clientX - rect.left) / rect.width;
    const tapY = (event.clientY - rect.top) / rect.height;

    // Undo the crop that object-fit: cover applies.
    const frameW = video.videoWidth || rect.width;
    const frameH = video.videoHeight || rect.height;
    const scale = Math.max(rect.width / frameW, rect.height / frameH);
    const shownW = frameW * scale;
    const shownH = frameH * scale;
    const x = (tapX * rect.width + (shownW - rect.width) / 2) / shownW;
    const y = (tapY * rect.height + (shownH - rect.height) / 2) / shownH;

    setFocusRing({ x: tapX * 100, y: tapY * 100 });
    await focusAtPoint(streamRef.current, x, y);
  }

  if (phase.kind === "unsupported") return null;

  return (
    <div className="absolute inset-0 bg-black">
      {/* Both surfaces are always mounted. Rendering them conditionally on
          `kind` meant the element didn't exist when the effect first ran, which
          left the whole start sequence stuck. */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className={`h-full w-full object-cover ${kind === "fallback" ? "hidden" : ""}`}
      />
      <div
        id={FALLBACK_ELEMENT_ID}
        className={`h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover ${
          kind === "fallback" ? "" : "hidden"
        }`}
      />

      {/* Tap layer sits above the video but before the chrome in DOM order, so
          the buttons still win the click without needing z-index juggling. */}
      {phase.kind === "scanning" && tapFocusAvailable ? (
        <div className="absolute inset-0" onClick={handleFocusTap} aria-hidden="true" />
      ) : null}

      {focusRing ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute size-16 -translate-x-1/2 -translate-y-1/2 border-2 border-accent motion-safe:animate-[focusPulse_900ms_ease-out]"
          style={{ left: `${focusRing.x}%`, top: `${focusRing.y}%` }}
        >
          <style>{`
            @keyframes focusPulse {
              0%   { transform: translate(-50%,-50%) scale(1.5); opacity: 0 }
              25%  { transform: translate(-50%,-50%) scale(1);   opacity: 1 }
              100% { transform: translate(-50%,-50%) scale(1);   opacity: 0 }
            }
          `}</style>
        </div>
      ) : null}

      {phase.kind === "scanning" ? (
        <Viewfinder paused={paused} />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
          {phase.kind === "denied" ? (
            <div className="max-w-xs bg-surface p-5">
              <p className="disp text-base">Camera unavailable</p>
              <p className="mt-2 text-sm text-ink-muted">{phase.message}</p>
              <p className="mt-3 text-xs text-ink-faint">
                You can still add books by ISBN or by searching — the buttons below
                work either way.
              </p>
            </div>
          ) : stalled ? (
            <div className="max-w-xs bg-surface p-5">
              <p className="disp text-base">Camera didn&apos;t start</p>
              <p className="mt-2 text-sm text-ink-muted">
                Try reloading. If it keeps happening, the buttons below still work.
              </p>
              <p className="mt-3 font-mono text-[11px] text-ink-faint">
                detector: {kind} · phase: {phase.kind}
              </p>
            </div>
          ) : (
            <p className="text-sm text-white/80">
              {phase.kind === "checking" ? "Checking camera…" : "Starting camera…"}
            </p>
          )}
        </div>
      )}

      {torchAvailable && phase.kind === "scanning" ? (
        <button
          type="button"
          onClick={toggleTorch}
          aria-pressed={torchOn}
          aria-label={torchOn ? "Turn torch off" : "Turn torch on"}
          className={`absolute right-4 top-4 flex size-11 items-center justify-center backdrop-blur ${
            torchOn ? "bg-accent text-on-accent" : "bg-black/50 text-white"
          }`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-5">
            <path d="M9 2h6v4l-1 3h-4L9 6zM10 9h4v5l-2 8-2-8z" strokeLinejoin="round" />
          </svg>
        </button>
      ) : null}

      <Link
        href="/"
        aria-label="Back to library"
        className="absolute left-4 top-4 flex size-11 items-center justify-center bg-black/50 text-white backdrop-blur"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-5">
          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
    </div>
  );
}

function Viewfinder({ paused }: { paused: boolean }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {/* Dimmed surround with a clear window, drawn as four panels so the middle
          stays fully transparent — a box-spread would tint the video. */}
      <div className="absolute inset-x-0 top-0 h-[calc(50%-5rem)] bg-black/55" />
      <div className="absolute inset-x-0 bottom-0 h-[calc(50%-5rem)] bg-black/55" />
      <div className="absolute left-0 top-[calc(50%-5rem)] h-40 w-[calc(50%-9rem)] bg-black/55" />
      <div className="absolute right-0 top-[calc(50%-5rem)] h-40 w-[calc(50%-9rem)] bg-black/55" />

      <div className="absolute left-1/2 top-1/2 h-40 w-72 -translate-x-1/2 -translate-y-1/2 border-2 border-white/70">
        {!paused ? (
          <div className="absolute inset-x-0 top-1/2 h-0.5 bg-accent motion-safe:animate-[scanline_2s_ease-in-out_infinite]" />
        ) : null}
      </div>

      <style>{`
        @keyframes scanline {
          0%, 100% { transform: translateY(-4.5rem); opacity: .9 }
          50%      { transform: translateY(4.5rem);  opacity: .9 }
        }
      `}</style>
    </div>
  );
}

function describeCameraError(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Permission was denied. Allow camera access for this site in your browser settings, then reload.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "No camera was found on this device.";
    case "NotReadableError":
      return "The camera is already in use by another app.";
    default:
      return "The camera could not be started.";
  }
}
