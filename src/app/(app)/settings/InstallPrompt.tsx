"use client";

import { useEffect, useState } from "react";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Shown only when the browser actually offers installation.
 *
 * A permanently visible "Install" button that does nothing on iOS — where the
 * event never fires — is worse than no button, so this renders nothing until
 * `beforeinstallprompt` arrives.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    function capture(event: Event) {
      event.preventDefault(); // Stop Chrome's own mini-infobar; we place it.
      setDeferred(event as InstallEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setDeferred(null);
    }

    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) {
    return <p className="mt-2 text-sm text-ink-muted">Installed. Open it from your home screen.</p>;
  }

  if (!deferred) {
    return (
      <p className="mt-2 text-sm text-ink-muted">
        Not available here. On iOS, use Share → Add to Home Screen.
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={async () => {
        await deferred.prompt();
        await deferred.userChoice;
        // The event can only be used once, whatever the outcome.
        setDeferred(null);
      }}
      className="mt-2 min-h-11 bg-accent px-4 text-sm font-medium text-on-accent"
    >
      Install Stacks
    </button>
  );
}
