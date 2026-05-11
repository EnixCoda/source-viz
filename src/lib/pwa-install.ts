// Captures the browser's beforeinstallprompt event so we can trigger it on demand.
// Chrome/Edge fire this; Safari does not.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });
}

export function canPromptInstall(): boolean {
  return deferredPrompt !== null;
}

export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferredPrompt) return "unavailable";
  const event = deferredPrompt;
  deferredPrompt = null;
  notify();
  await event.prompt();
  const choice = await event.userChoice;
  return choice.outcome;
}

export function subscribeInstallAvailability(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // Safari iOS
  return (window.navigator as { standalone?: boolean }).standalone === true;
}

export function isSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(ua);
}
