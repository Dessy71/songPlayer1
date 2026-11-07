/** iOS reserves HTML media loudness for the hardware buttons / Control Center.
 * Keep native media playback (including background/lock-screen audio) rather
 * than routing it through a Web Audio graph just to simulate a volume slider.
 */
export function usesSystemVolume(device: Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'>): boolean {
  return /iPad|iPhone|iPod/.test(device.userAgent) ||
    (device.platform === 'MacIntel' && device.maxTouchPoints > 1);
}

export function applyAudioVolume(audio: Pick<HTMLMediaElement, 'volume' | 'muted'>, volume: number, muted: boolean) {
  const level = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0.9;
  // Unlike .volume, .muted is supported by iPhone Safari.
  audio.muted = muted || level === 0;
  try { audio.volume = level; } catch { /* Some native media backends own volume. */ }
}
