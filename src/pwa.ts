/**
 * PWA-compatible file capture utilities.
 *
 * In Android Chrome PWA standalone mode, <input type="file"> is broken
 * (crbug.com/974971, crbug.com/1202062).  These functions use modern
 * browser APIs (getUserMedia, showOpenFilePicker) that work correctly
 * in standalone mode.
 */

/** Capture a photo from the rear camera using getUserMedia. */
export async function capturePhoto(): Promise<File | null> {
  if (!navigator.mediaDevices?.getUserMedia) {
    console.warn('[PWA] getUserMedia not available');
    return null;
  }

  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1920 } },
      audio: false,
    });

    // Play video briefly so the sensor warms up and focus locks
    const video = document.createElement('video');
    video.srcObject = stream;
    video.playsInline = true;
    video.muted = true;
    await video.play();

    // Wait for the camera to stabilise
    await new Promise((r) => setTimeout(r, 400));

    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    // Flip horizontally so it looks like a mirror (like native camera)
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);

    // Stop all tracks immediately
    stream.getTracks().forEach((t) => t.stop());
    stream = null;

    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob((b) => res(b), 'image/jpeg', 0.85),
    );
    if (!blob) return null;

    return new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
  } catch (err: any) {
    if (err?.name === 'NotAllowedError') {
      console.warn('[PWA] Camera permission denied');
    } else {
      console.error('[PWA] getUserMedia error:', err);
    }
    return null;
  } finally {
    stream?.getTracks().forEach((t) => t.stop());
  }
}

/** Pick an image from the gallery using the File System Access API. */
export async function pickImage(): Promise<File | null> {
  if (!('showOpenFilePicker' in window)) {
    console.warn('[PWA] showOpenFilePicker not available');
    return null;
  }

  try {
    const [handle] = await (window as any).showOpenFilePicker({
      types: [
        {
          description: 'Images',
          accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'] },
        },
      ],
      multiple: false,
    });
    const file = await handle.getFile();
    return file;
  } catch (err: any) {
    // User cancelled – not an error
    if (err?.name === 'AbortError' || err?.message?.includes('abort')) {
      return null;
    }
    console.error('[PWA] showOpenFilePicker error:', err);
    return null;
  }
}

/** Check whether the app is running in a PWA standalone context. */
export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches;
}

/** Detect if we are on an Android device (user-agent sniff). */
export function isAndroid(): boolean {
  return /android/i.test(navigator.userAgent);
}
