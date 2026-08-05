/**
 * Barcode detection, feature-detected at runtime.
 *
 * Native `BarcodeDetector` is fast and battery-cheap and exists on Android
 * Chrome — the primary cataloguing device. Everything else (notably iOS Safari)
 * falls back to html5-qrcode, which is ~300 KB and therefore only ever loaded
 * dynamically on devices that actually need it.
 */

export type DetectorKind = "native" | "fallback" | "unsupported";

/** Minimal shape of the native API; TS has no lib types for it yet. */
type NativeBarcodeDetector = {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string; format: string }>>;
};

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
  },
  audio: false,
};

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
