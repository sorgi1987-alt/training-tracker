import { useSyncExternalStore } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

// Module-level state, with listeners registered immediately at import time
// rather than inside a React effect. `beforeinstallprompt` fires at most
// once per page load, whenever Chrome decides the page qualifies — which
// can happen right away, before the user has navigated to whichever page
// hosts the install button. A listener scoped to that one page's mount
// effect can miss the event permanently; a module-level listener catches it
// no matter which route is active when it fires.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = typeof window !== 'undefined' && isStandalone();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferredPrompt = null;
    notify();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return `${installed}:${Boolean(deferredPrompt)}`;
}

export function useInstallPrompt() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  const [installedFlag, canPromptFlag] = snapshot.split(':');

  async function promptInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    notify();
  }

  const isInstalled = installedFlag === 'true';
  return {
    installed: isInstalled,
    canPromptInstall: canPromptFlag === 'true',
    showIosInstructions: isIos() && !isInstalled,
    promptInstall
  };
}
