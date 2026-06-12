/**
 * PWA-compatible file capture utilities.
 *
 * In Android Chrome PWA standalone mode, <input type="file"> is broken
 * (crbug.com/974971, crbug.com/1202062).
 *
 * Workaround: navigate to picker.html using a target="_blank" anchor
 * (which opens in the system browser, not the WebAPK), let the user
 * select a photo there, then receive it back via localStorage.
 */

const PICKER_URL = '/calsnap/picker.html';
const LS_KEY = 'calsnap_pending_photo';
const LS_TIME_KEY = 'calsnap_pending_photo_time';

/** Callback that will be invoked when a photo arrives from the picker. */
let onPhotoReceived: ((dataUrl: string) => void) | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

/** Listen for photos saved by the picker page via the storage event. */
window.addEventListener('storage', (e) => {
  if (e.key === LS_KEY && e.newValue && onPhotoReceived) {
    const cb = onPhotoReceived;
    stopPolling();
    onPhotoReceived = null;
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(LS_TIME_KEY);
    cb(e.newValue);
  }
});

/** Also poll localStorage periodically as a fallback (storage event may not fire across WebAPK ↔ browser boundary). */
function startPolling() {
  stopPolling();
  pollTimer = setInterval(() => {
    const data = localStorage.getItem(LS_KEY);
    if (data && onPhotoReceived) {
      const time = parseInt(localStorage.getItem(LS_TIME_KEY) || '0', 10);
      // Only accept if written within the last 60 seconds
      if (Date.now() - time < 60000) {
        const cb = onPhotoReceived;
        stopPolling();
        onPhotoReceived = null;
        localStorage.removeItem(LS_KEY);
        localStorage.removeItem(LS_TIME_KEY);
        cb(data);
      }
    }
  }, 500);
}

function stopPolling() {
  if (pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

/**
 * Open picker.html in the system browser and wait for the user to
 * select a photo.  Returns a dataUrl string, or null if cancelled.
 */
export function pickPhotoInBrowserTab(): Promise<string | null> {
  return new Promise((resolve) => {
    onPhotoReceived = resolve;
    startPolling();

    // Create an anchor with target="_blank" – in Android PWA standalone
    // mode this opens in the system browser, not the WebAPK.
    const a = document.createElement('a');
    a.href = PICKER_URL;
    a.target = '_blank';
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Timeout after 5 minutes
    setTimeout(() => {
      if (onPhotoReceived) {
        stopPolling();
        onPhotoReceived = null;
        resolve(null);
      }
    }, 300000);
  });
}

/** Check whether the app is running in a PWA standalone context. */
export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches;
}
