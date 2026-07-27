/**
 * Native picture-in-picture, wrapped so a refusal is never fatal.
 *
 * The browser only grants `requestPictureInPicture()` while a user gesture is
 * still in play, and each engine draws that line slightly differently. Every
 * call here resolves to a boolean instead of throwing, so a refused request
 * degrades to "keeps playing offscreen" rather than breaking navigation.
 */

export function isPipSupported(): boolean {
  return typeof document !== 'undefined' && 'exitPictureInPicture' in document;
}

/** `document.pictureInPictureElement` is the only source of truth for this. */
export function isPipActive(videoEl: HTMLVideoElement | null): boolean {
  if (!videoEl) return false;
  return document.pictureInPictureElement === videoEl;
}

export function isAnyPipActive(): boolean {
  return document.pictureInPictureElement !== null;
}

export async function requestPip(videoEl: HTMLVideoElement | null): Promise<boolean> {
  if (!videoEl || !isPipSupported()) return false;
  if (isPipActive(videoEl)) return true;
  if (videoEl.disablePictureInPicture) return false;

  try {
    await videoEl.requestPictureInPicture();
    return true;
  } catch {
    // Almost always NotAllowedError: the gesture that triggered the navigation
    // had already been spent, or the engine declined outright.
    return false;
  }
}

export async function exitPip(): Promise<void> {
  if (!isPipSupported() || !isAnyPipActive()) return;
  try {
    await document.exitPictureInPicture();
  } catch {
    // Exiting a window the browser already closed is not worth reporting.
  }
}
