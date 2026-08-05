/**
 * Barcode detection, feature-detected at runtime.
 *
 * Native `BarcodeDetector` is fast and battery-cheap and exists on Android
 * Chrome — the primary cataloguing device. Everything else (notably iOS Safari)
 * falls back to html5-qrcode, which is ~300 KB and therefore only ever loaded
 * dynamically on devices that actually need it.
 */

export type DetectorKind = "native" | "fallback" | "unsupported";

export type DetectedCode = {
  rawValue: string;
  format: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
};

/** Minimal shape of the native API; TS has no lib types for it yet. */
type NativeBarcodeDetector = {
  detect: (source: CanvasImageSource) => Promise<DetectedCode[]>;
};

/**
 * Order candidates by how close they are to the centre of the frame.
 *
 * Book barcodes rarely appear alone: house editions carry an EAN-5 price add-on
 * beside the ISBN, shops add their own sticker, and a second book is often in
 * shot. Whatever you have aimed at is the one you meant, so centre-most wins.
 */
export function rankByCentrality(
  codes: DetectedCode[],
  frameWidth: number,
  frameHeight: number,
): string[] {
  if (frameWidth <= 0 || frameHeight <= 0) return codes.map((c) => c.rawValue);

  const cx = frameWidth / 2;
  const cy = frameHeight / 2;

  const distance = (code: DetectedCode): number => {
    const box = code.boundingBox;
    // No box means no basis to rank it; send it to the back rather than guess.
    if (!box) return Number.POSITIVE_INFINITY;
    const bx = box.x + box.width / 2;
    const by = box.y + box.height / 2;
    return (bx - cx) ** 2 + (by - cy) ** 2;
  };

  return [...codes].sort((a, b) => distance(a) - distance(b)).map((c) => c.rawValue);
}

type BarcodeDetectorCtor = {
  new (options?: { formats?: string[] }): NativeBarcodeDetector;
  getSupportedFormats?: () => Promise<string[]>;
};

function nativeCtor(): BarcodeDetectorCtor | null {
  if (typeof window === "undefined") return null;
  const ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  return typeof ctor === "function" ? ctor : null;
}

export function hasCamera(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function"
  );
}

export async function detectSupport(): Promise<DetectorKind> {
  // getUserMedia requires a secure context. Without it there is nothing to fall
  // back to — the manual paths take over entirely.
  if (!hasCamera()) return "unsupported";

  const ctor = nativeCtor();
  if (ctor) {
    try {
      // Presence of the constructor isn't enough: some builds ship it without
      // EAN-13, which is the only format that matters here.
      const formats = (await ctor.getSupportedFormats?.()) ?? [];
      if (formats.includes("ean_13")) return "native";
    } catch {
      // Fall through — a throwing feature check is a missing feature.
    }
  }

  return "fallback";
}

export function createNativeDetector(): NativeBarcodeDetector | null {
  const ctor = nativeCtor();
  if (!ctor) return null;
  try {
    return new ctor({ formats: ["ean_13"] });
  } catch {
    return null;
  }
}

/**
 * Stops every track on a stream. Called on unmount, on route change, and before
 * any re-acquire.
 *
 * A leaked stream keeps the camera light on and drains the phone, and it is
 * invisible during desktop testing — treat a missed call here as a real bug.
 */
export function stopStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch {
      // Already stopped; nothing to do.
    }
  });
}

// `torch` is a well-supported Chrome/Android extension that the standard DOM
// typings don't cover yet, so both sides need a deliberate cast.
type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean };

export function supportsTorch(stream: MediaStream | null): boolean {
  const track = stream?.getVideoTracks()[0];
  if (!track?.getCapabilities) return false;
  try {
    return (track.getCapabilities() as TorchCapabilities).torch === true;
  } catch {
    return false;
  }
}

export async function setTorch(stream: MediaStream | null, on: boolean): Promise<boolean> {
  const track = stream?.getVideoTracks()[0];
  if (!track) return false;
  try {
    await track.applyConstraints({
      advanced: [{ torch: on }],
    } as unknown as MediaTrackConstraints);
    return true;
  } catch {
    return false;
  }
}

/** Rear camera, and a resolution high enough to resolve a barcode at arm's length. */
export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    facingMode: { ideal: "environment" },
    width: { ideal: 1280 },
    height: { ideal: 720 },
    // Ask for continuous autofocus up front. Without it some devices hand back a
    // fixed-focus stream, which simply cannot resolve a barcode held close.
    // Not in the standard typings, hence the cast at the end.
    advanced: [{ focusMode: "continuous" }],
  } as unknown as MediaTrackConstraints,
  audio: false,
};

// --- focus ------------------------------------------------------------------
// focusMode and pointsOfInterest are MediaTrackConstraints extensions: real and
// widely implemented on Android Chrome, absent from the DOM typings, and absent
// from some cameras entirely. Every helper reports whether it actually worked.

type FocusCapabilities = MediaTrackCapabilities & {
  focusMode?: string[];
  pointsOfInterest?: unknown;
};

export type FocusSupport = { continuous: boolean; tapToFocus: boolean };

export function focusSupport(stream: MediaStream | null): FocusSupport {
  const track = stream?.getVideoTracks()[0];
  if (!track?.getCapabilities) return { continuous: false, tapToFocus: false };
  try {
    const caps = track.getCapabilities() as FocusCapabilities;
    const modes = caps.focusMode ?? [];
    return {
      continuous: modes.includes("continuous"),
      // Needs a point to aim at AND a mode that acts on it.
      tapToFocus:
        "pointsOfInterest" in caps &&
        (modes.includes("single-shot") || modes.includes("manual") || modes.includes("continuous")),
    };
  } catch {
    return { continuous: false, tapToFocus: false };
  }
}

async function applyFocus(
  stream: MediaStream | null,
  constraint: Record<string, unknown>,
): Promise<boolean> {
  const track = stream?.getVideoTracks()[0];
  if (!track) return false;
  try {
    await track.applyConstraints({ advanced: [constraint] } as unknown as MediaTrackConstraints);
    return true;
  } catch {
    return false;
  }
}

export async function enableContinuousFocus(stream: MediaStream | null): Promise<boolean> {
  return applyFocus(stream, { focusMode: "continuous" });
}

/**
 * Focus at a point, given in normalized 0–1 coordinates of the video frame.
 *
 * Drops back to continuous afterwards so the camera keeps tracking once you
 * move to the next book — a one-shot focus that never re-engages is worse than
 * no tap-to-focus at all.
 */
export async function focusAtPoint(
  stream: MediaStream | null,
  x: number,
  y: number,
): Promise<boolean> {
  const clampedX = Math.min(1, Math.max(0, x));
  const clampedY = Math.min(1, Math.max(0, y));

  const ok =
    (await applyFocus(stream, {
      pointsOfInterest: [{ x: clampedX, y: clampedY }],
      focusMode: "single-shot",
    })) ||
    // Some cameras reject single-shot but honour the point under continuous.
    (await applyFocus(stream, { pointsOfInterest: [{ x: clampedX, y: clampedY }] }));

  return ok;
}

// --- feedback ---------------------------------------------------------------

/** Short confirmation tone. Synthesized so there's no audio asset to ship or cache. */
export function beep(): void {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;

    const ctx = new Ctx();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);

    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.13);
    oscillator.onended = () => void ctx.close();
  } catch {
    // Audio is a nicety; never let it break a scan.
  }
}

export function vibrate(ms = 50): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Not supported on iOS; the beep carries the feedback there.
  }
}
