// Tiny Web Audio helpers shared by the Metronome and Guitar Chords tabs.
// One lazily-created AudioContext per tab session; everything is synthesized
// (no audio assets to ship). All functions no-op gracefully when the Web Audio
// API is unavailable (SSR / old browsers).

let ctx: AudioContext | null = null;

/** Lazily create (and resume) a shared AudioContext. */
export function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/**
 * Pluck a single string: a quick attack + exponential decay on two detuned
 * oscillators for a slightly richer, guitar-ish tone.
 */
function pluck(audio: AudioContext, freq: number, at: number, gain = 0.22) {
  const out = audio.createGain();
  out.gain.setValueAtTime(0.0001, at);
  out.gain.exponentialRampToValueAtTime(gain, at + 0.006);
  out.gain.exponentialRampToValueAtTime(0.0001, at + 1.6);
  out.connect(audio.destination);

  for (const [type, mult, level] of [
    ["triangle", 1, 1],
    ["sawtooth", 2.001, 0.28],
  ] as const) {
    const osc = audio.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq * mult, at);
    const g = audio.createGain();
    g.gain.value = level;
    osc.connect(g).connect(out);
    osc.start(at);
    osc.stop(at + 1.7);
  }
}

/** Strum a chord (MIDI notes, low → high) with a small per-string delay. */
export function playChord(midiNotes: number[], strumMs = 32): void {
  const audio = getAudioContext();
  if (!audio) return;
  const t0 = audio.currentTime + 0.02;
  midiNotes.forEach((m, i) => pluck(audio, midiToFreq(m), t0 + (i * strumMs) / 1000));
}

/** A short metronome click. accent = downbeat (higher pitch, louder). */
export function click(audio: AudioContext, at: number, accent: boolean): void {
  const osc = audio.createOscillator();
  const g = audio.createGain();
  osc.frequency.setValueAtTime(accent ? 1500 : 900, at);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.32, at + 0.001);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
  osc.connect(g).connect(audio.destination);
  osc.start(at);
  osc.stop(at + 0.06);
}
