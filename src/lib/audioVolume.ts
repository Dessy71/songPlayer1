/**
 * Phones and tablets hand media loudness to the hardware buttons. iOS ignores
 * HTMLMediaElement.volume outright; Android and other mobile browsers accept
 * the write but the user still reaches for the physical buttons first, so an
 * in-app slider would silently disagree with what they hear.
 *
 * Keep native media playback (including background/lock-screen audio) rather
 * than routing it through a Web Audio graph just to simulate a slider.
 */
export function usesSystemVolume(device: Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'>): boolean {
  const ua = device.userAgent || '';
  // iOS: Safari ignores volume writes entirely.
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  // iPadOS 13+ reports itself as a Mac, so touch is the tell.
  if (device.platform === 'MacIntel' && (device.maxTouchPoints ?? 0) > 1) return true;
  // Android, Kindle, BlackBerry, Windows Phone and other handheld browsers.
  // A touch-screen laptop is deliberately excluded: it still has real speakers
  // and a keyboard, so the in-app slider is the right control there.
  if (/Android|Mobile|Silk|Kindle|BlackBerry|BB10|Opera Mini|Opera Mobi|webOS|IEMobile|Windows Phone/i.test(ua)) return true;
  return false;
}

export function applyAudioVolume(audio: Pick<HTMLMediaElement, 'volume' | 'muted'>, volume: number, muted: boolean) {
  const level = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0.9;
  // Unlike .volume, .muted is supported by iPhone Safari.
  audio.muted = muted || level === 0;
  try { audio.volume = level; } catch { /* Some native media backends own volume. */ }
}
