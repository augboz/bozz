// Ambient audio — a single looping background sound tied to a Bozz World.
// The webview plays audio directly (HTMLAudioElement); no Tauri plugin needed.
// Featherweight by design: calm background sound, not a music player.

let el: HTMLAudioElement | null = null;
let fadeTimer: ReturnType<typeof setInterval> | null = null;
let targetVolume = 0.25;

function getEl(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (!el) {
    el = new Audio();
    el.loop = true;
    el.preload = 'auto';
    el.volume = 0;
  }
  return el;
}

function clearFade(): void {
  if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; }
}

function fadeTo(vol: number, done?: () => void): void {
  const a = getEl();
  if (!a) return;
  clearFade();
  const step = (vol - a.volume) / 12;
  fadeTimer = setInterval(() => {
    if (!a) { clearFade(); return; }
    const next = a.volume + step;
    if ((step >= 0 && next >= vol) || (step < 0 && next <= vol)) {
      a.volume = Math.max(0, Math.min(1, vol));
      clearFade();
      done?.();
    } else {
      a.volume = Math.max(0, Math.min(1, next));
    }
  }, 40);
}

/** Start (or switch to) a looping sound and fade it in. */
export async function play(url: string, volume = targetVolume): Promise<void> {
  const a = getEl();
  if (!a) return;
  targetVolume = volume;
  if (a.src !== url) a.src = url;
  try {
    a.volume = 0;
    await a.play();
    fadeTo(volume);
  } catch (e) {
    // Autoplay may be blocked until a user gesture — that's fine, the next
    // explicit play() from a click will succeed.
    console.warn('[ambient] play blocked:', e);
  }
}

/** Fade out and pause. */
export function stop(): void {
  const a = getEl();
  if (!a) return;
  fadeTo(0, () => { a.pause(); });
}

export function setVolume(volume: number): void {
  targetVolume = Math.max(0, Math.min(1, volume));
  const a = getEl();
  if (a && !a.paused) { clearFade(); a.volume = targetVolume; }
}

export function mute(on: boolean): void {
  const a = getEl();
  if (a) a.muted = on;
}

export function isPlaying(): boolean {
  return !!el && !el.paused;
}
