/**
 * PWA-compatible file capture utilities.
 *
 * In Android Chrome PWA standalone mode, <input type="file"> is broken
 * (crbug.com/974971, crbug.com/1202062).
 *
 * Workaround: open a picker page in a regular browser tab via window.open,
 * where file input works normally.  The picker page sends the photo back
 * via postMessage or localStorage.
 */

const PICKER_URL = '/calsnap/picker.html';
const LS_KEY = 'calsnap_pending_photo';
const LS_TIME_KEY = 'calsnap_pending_photo_time';

let pendingResolve: ((dataUrl: string | null) => void) | null = null;

/** Listen for photos coming back from the picker page. */
function startPickerListener() {
  // Listen for postMessage from popup window
  window.addEventListener('message', (e) => {
    if (e.data?.type === 'PICKER_PHOTO' && e.data?.dataUrl) {
      if (pendingResolve) {
        pendingResolve(e.data.dataUrl);
        pendingResolve = null;
      }
    }
  });

  // Also check localStorage (fallback if postMessage fails)
  window.addEventListener('storage', (e) => {
    if (e.key === LS_KEY && e.newValue) {
      if (pendingResolve) {
        pendingResolve(e.newValue);
        pendingResolve = null;
      }
      localStorage.removeItem(LS_KEY);
      localStorage.removeItem(LS_TIME_KEY);
    }
  });

  // Check if there's already a pending photo (e.g. page just loaded)
  const existing = localStorage.getItem(LS_KEY);
  if (existing) {
    const time = parseInt(localStorage.getItem(LS_TIME_KEY) || '0', 10);
    // Only use if less than 60 seconds old
    if (Date.now() - time < 60000) {
      setTimeout(() => {
        if (pendingResolve) {
          pendingResolve(existing);
          pendingResolve = null;
        }
      }, 100);
    }
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(LS_TIME_KEY);
  }
}

// Start listener immediately on module load
startPickerListener();

/**
 * Open the picker page in a new browser tab and wait for the user to select
 * a photo.  Returns a dataUrl string, or null if cancelled.
 */
export function pickPhotoInBrowserTab(): Promise<string | null> {
  return new Promise((resolve) => {
    pendingResolve = resolve;

    // Open picker page in a new window/tab
    const win = window.open(PICKER_URL, '_blank', 'width=400,height=650');

    if (!win) {
      // Popup blocked – show a message to the user
      resolve(null);
      return;
    }

    // Timeout after 5 minutes
    setTimeout(() => {
      if (pendingResolve) {
        pendingResolve(null);
        pendingResolve = null;
      }
    }, 300000);
  });
}

/** Check whether the app is running in a PWA standalone context. */
export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.matchMedia('(display-mode: minimal-ui)').matches;
}
