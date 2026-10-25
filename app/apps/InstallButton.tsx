"use client";

import { useSyncExternalStore } from "react";
import { ArrowUpRight, Download } from "lucide-react";
import styles from "./apps.module.css";

type PromptOutcome = { outcome: "accepted" | "dismissed"; platform: string };
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<PromptOutcome>;
};
type InstallState = "checking" | "installable" | "installing" | "installed" | "unavailable";
type Snapshot = { state: InstallState; message: string };

declare global {
  interface WindowEventMap {
    beforeinstallprompt: InstallPromptEvent;
    appinstalled: Event;
  }
}

const STUDENT_APP_URL = "/student-app/";
const INSTALL_CHECK_TIMEOUT_MS = 5000;
const INSTALL_CONFIRM_TIMEOUT_MS = 15000;

let snapshot: Snapshot = { state: "checking", message: "" };
const serverSnapshot: Snapshot = { state: "checking", message: "" };
let deferredPrompt: InstallPromptEvent | null = null;
let initialized = false;
let listeners = new Set<() => void>();
let checkTimer: number | undefined;
let confirmTimer: number | undefined;

function publish(state: InstallState, message = "") {
  snapshot = { state, message };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function getSnapshot() {
  return snapshot;
}

function getServerSnapshot(): Snapshot {
  return serverSnapshot;
}

function initializeInstallManager() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  const standalone = window.matchMedia("(display-mode: standalone)").matches
    || ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
  if (standalone) {
    publish("installed");
    return;
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    window.clearTimeout(checkTimer);
    publish("installable");
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    window.clearTimeout(checkTimer);
    window.clearTimeout(confirmTimer);
    publish("installed");
  });

  if ("serviceWorker" in navigator) {
    try {
      void navigator.serviceWorker.register("/student-app/flutter_service_worker.js", {
        scope: "/student-app",
      }).catch(() => {
        // The prompt remains unavailable unless the browser itself offers it.
      });
    } catch {
      // Service workers require a secure context; the UI will remain unavailable.
    }
  }

  // The event can arrive later if Chrome's installability checks or engagement
  // heuristics have not completed yet. Keep listening after this UI fallback.
  checkTimer = window.setTimeout(() => {
    if (!deferredPrompt && snapshot.state === "checking") {
      publish("unavailable", "Native install is not available in this browser or context.");
    }
  }, INSTALL_CHECK_TIMEOUT_MS);
}

// InstallButton is imported with the /apps page's initial client bundle. Attach
// once at module evaluation so hydration timing and duplicate platform cards
// cannot miss or multiply the browser event listener.
if (typeof window !== "undefined") initializeInstallManager();

function useInstallSnapshot() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

async function promptInstall() {
  const promptEvent = deferredPrompt;
  if (!promptEvent) {
    publish("unavailable", "Native install is not available in this browser or context.");
    return;
  }

  deferredPrompt = null;
  window.clearTimeout(checkTimer);
  publish("installing");

  try {
    // Invoke prompt synchronously in this click handler before awaiting anything.
    const promptResult = promptEvent.prompt();
    await promptResult;
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "dismissed") {
      publish("unavailable", "Installation was cancelled.");
      return;
    }

    // An accepted choice is not proof of installation. Wait briefly for the
    // browser's appinstalled event; never label the app installed on choice alone.
    confirmTimer = window.setTimeout(() => {
      if (snapshot.state === "installing") {
        publish("unavailable", "The browser did not confirm that the app was installed.");
      }
    }, INSTALL_CONFIRM_TIMEOUT_MS);
  } catch {
    publish("unavailable", "The browser could not open the install prompt.");
  }
}

export function InstallButton({ platform }: { platform: "android" | "iphone" }) {
  const { state, message } = useInstallSnapshot();

  if (state === "installed") {
    return (
      <a className={styles.installButton} href={STUDENT_APP_URL}>
        <span>Open App</span><ArrowUpRight size={15} aria-hidden="true" />
      </a>
    );
  }

  if (platform === "iphone") {
    return (
      <div className={styles.installAction}>
        <a className={`${styles.installButton} ${styles.secondaryInstall}`} href={STUDENT_APP_URL}>
          <span>Open App</span><ArrowUpRight size={15} aria-hidden="true" />
        </a>
        <span className={styles.installNote}>Install from Safari’s Share menu</span>
      </div>
    );
  }

  const disabled = state !== "installable";
  const label = state === "checking"
    ? "Checking…"
    : state === "installable"
      ? "Install"
      : state === "installing"
        ? "Installing…"
        : "Install unavailable";

  return (
    <div className={styles.installAction}>
      <button
        className={styles.installButton}
        type="button"
        onClick={() => void promptInstall()}
        disabled={disabled}
        aria-label={label}
      >
        <Download size={15} aria-hidden="true" />
        <span>{label}</span>
      </button>
      {message && <span className={styles.installNote} role="status">{message}</span>}
    </div>
  );
}
