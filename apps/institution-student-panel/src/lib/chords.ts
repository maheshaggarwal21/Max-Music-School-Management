// Guitar chord engine — generates playable, fret-accurate shapes for every
// (root × type) combination without shipping a 130-entry hand table.
//
// Method: a small set of curated OPEN-position shapes for the friendly keys,
// plus movable E-shape / A-shape barre templates that transpose up the neck for
// everything else. Both are standard, verified voicings, so every generated
// diagram is a real chord a student can actually play.

// Standard tuning, low → high (6th → 1st string): E2 A2 D3 G3 B3 E4 as MIDI.
export const STRING_MIDI = [40, 45, 50, 55, 59, 64] as const;

/** Chromatic roots (sharps); display labels carry the enharmonic. */
export const ROOTS = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
] as const;
export type Root = (typeof ROOTS)[number];

export const ROOT_LABEL: Record<Root, string> = {
  C: "C",
  "C#": "C# / Db",
  D: "D",
  "D#": "D# / Eb",
  E: "E",
  F: "F",
  "F#": "F# / Gb",
  G: "G",
  "G#": "G# / Ab",
  A: "A",
  "A#": "A# / Bb",
  B: "B",
};

/** Short name drawn big on each card, e.g. C, C#, Bb. */
export const ROOT_SHORT: Record<Root, string> = {
  C: "C", "C#": "C#", D: "D", "D#": "Eb", E: "E", F: "F",
  "F#": "F#", G: "G", "G#": "Ab", A: "A", "A#": "Bb", B: "B",
};

export const CHORD_TYPES = [
  { key: "major", label: "MAJOR", suffix: "" },
  { key: "minor", label: "MINOR", suffix: "m" },
  { key: "7", label: "7", suffix: "7" },
  { key: "maj7", label: "MAJ7", suffix: "maj7" },
  { key: "m7", label: "M7", suffix: "m7" },
  { key: "sus2", label: "SUS2", suffix: "sus2" },
  { key: "sus4", label: "SUS4", suffix: "sus4" },
  { key: "add9", label: "ADD9", suffix: "add9" },
  { key: "6", label: "6", suffix: "6" },
  { key: "dim", label: "DIM", suffix: "dim" },
  { key: "5", label: "5", suffix: "5" },
] as const;
export type ChordType = (typeof CHORD_TYPES)[number]["key"];

const PC: Record<Root, number> = {
  C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5,
  "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11,
};

export interface ChordShape {
  /** 6 entries (6th→1st string). -1 = muted, 0 = open, n = fret. */
  frets: number[];
  /** 6 entries — finger 0=none, 1–4. */
  fingers: number[];
  /** Lowest played fret (position marker). 1 = open/first position. */
  position: number;
  /** Optional barre: half-step fret + barred string span (indices 0..5). */
  barre?: { fret: number; from: number; to: number };
}

// ── Movable templates ────────────────────────────────────────────────────────
// offsets are relative to the barre fret R (root). "x" = muted string.
// rootString: 6 → E-shape (root on 6th string), 5 → A-shape (root on 5th).
type Tmpl = {
  rootString: 5 | 6;
  offsets: (number | "x")[]; // 6th→1st
  fingers: number[];
  barre: boolean;
};

const E: Record<string, Tmpl> = {
  major: { rootString: 6, offsets: [0, 2, 2, 1, 0, 0], fingers: [1, 3, 4, 2, 1, 1], barre: true },
  minor: { rootString: 6, offsets: [0, 2, 2, 0, 0, 0], fingers: [1, 3, 4, 1, 1, 1], barre: true },
  "7":   { rootString: 6, offsets: [0, 2, 0, 1, 0, 0], fingers: [1, 3, 1, 2, 1, 1], barre: true },
  maj7:  { rootString: 6, offsets: [0, 2, 1, 1, 0, 0], fingers: [1, 3, 2, 2, 1, 1], barre: true },
  m7:    { rootString: 6, offsets: [0, 2, 0, 0, 0, 0], fingers: [1, 3, 1, 1, 1, 1], barre: true },
  sus4:  { rootString: 6, offsets: [0, 2, 2, 2, 0, 0], fingers: [1, 2, 3, 4, 1, 1], barre: true },
  "6":   { rootString: 6, offsets: [0, 2, 2, 1, 2, 0], fingers: [1, 3, 4, 2, 1, 1], barre: true },
  "5":   { rootString: 6, offsets: [0, 2, 2, "x", "x", "x"], fingers: [1, 3, 4, 0, 0, 0], barre: false },
};

const A: Record<string, Tmpl> = {
  major: { rootString: 5, offsets: ["x", 0, 2, 2, 2, 0], fingers: [0, 1, 2, 3, 4, 1], barre: true },
  minor: { rootString: 5, offsets: ["x", 0, 2, 2, 1, 0], fingers: [0, 1, 3, 4, 2, 1], barre: true },
  "7":   { rootString: 5, offsets: ["x", 0, 2, 0, 2, 0], fingers: [0, 1, 3, 1, 4, 1], barre: true },
  maj7:  { rootString: 5, offsets: ["x", 0, 2, 1, 2, 0], fingers: [0, 1, 3, 2, 4, 1], barre: true },
  m7:    { rootString: 5, offsets: ["x", 0, 2, 0, 1, 0], fingers: [0, 1, 3, 1, 2, 1], barre: true },
  sus2:  { rootString: 5, offsets: ["x", 0, 2, 2, 0, 0], fingers: [0, 1, 3, 4, 1, 1], barre: true },
  sus4:  { rootString: 5, offsets: ["x", 0, 2, 2, 3, 0], fingers: [0, 1, 2, 3, 4, 1], barre: true },
  "6":   { rootString: 5, offsets: ["x", 0, 2, 2, 2, 2], fingers: [0, 1, 2, 3, 4, 4], barre: true },
  add9:  { rootString: 5, offsets: ["x", 0, 2, 4, 2, 0], fingers: [0, 1, 2, 4, 3, 1], barre: false },
  dim:   { rootString: 5, offsets: ["x", 0, 1, 2, 1, "x"], fingers: [0, 1, 2, 4, 3, 0], barre: false },
  "5":   { rootString: 5, offsets: ["x", 0, 2, 2, "x", "x"], fingers: [0, 1, 3, 4, 0, 0], barre: false },
};

// Curated open-position voicings (nicer than barre for these keys). Frets are
// absolute: -1 muted, 0 open. Keyed `${root}:${type}`.
const OPEN: Record<string, ChordShape> = {
  "C:major":  { frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0], position: 1 },
  "A:major":  { frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0], position: 1 },
  "G:major":  { frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3], position: 1 },
  "E:major":  { frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0], position: 1 },
  "D:major":  { frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2], position: 1 },
  "A:minor":  { frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0], position: 1 },
  "E:minor":  { frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0], position: 1 },
  "D:minor":  { frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1], position: 1 },
  "C:7":      { frets: [-1, 3, 2, 3, 1, 0], fingers: [0, 3, 2, 4, 1, 0], position: 1 },
  "A:7":      { frets: [-1, 0, 2, 0, 2, 0], fingers: [0, 0, 2, 0, 3, 0], position: 1 },
  "G:7":      { frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1], position: 1 },
  "E:7":      { frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0], position: 1 },
  "D:7":      { frets: [-1, -1, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3], position: 1 },
  "B:7":      { frets: [-1, 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 4], position: 1 },
  "C:maj7":   { frets: [-1, 3, 2, 0, 0, 0], fingers: [0, 3, 2, 0, 0, 0], position: 1 },
  "A:maj7":   { frets: [-1, 0, 2, 1, 2, 0], fingers: [0, 0, 2, 1, 3, 0], position: 1 },
  "D:maj7":   { frets: [-1, -1, 0, 2, 2, 2], fingers: [0, 0, 0, 1, 1, 1], position: 1 },
  "E:m7":     { frets: [0, 2, 0, 0, 0, 0], fingers: [0, 2, 0, 0, 0, 0], position: 1 },
  "A:m7":     { frets: [-1, 0, 2, 0, 1, 0], fingers: [0, 0, 2, 0, 1, 0], position: 1 },
  "D:m7":     { frets: [-1, -1, 0, 2, 1, 1], fingers: [0, 0, 0, 2, 1, 1], position: 1 },
  "A:sus2":   { frets: [-1, 0, 2, 2, 0, 0], fingers: [0, 0, 1, 2, 0, 0], position: 1 },
  "D:sus2":   { frets: [-1, -1, 0, 2, 3, 0], fingers: [0, 0, 0, 1, 2, 0], position: 1 },
  "A:sus4":   { frets: [-1, 0, 2, 2, 3, 0], fingers: [0, 0, 1, 2, 3, 0], position: 1 },
  "D:sus4":   { frets: [-1, -1, 0, 2, 3, 3], fingers: [0, 0, 0, 1, 2, 3], position: 1 },
  "E:sus4":   { frets: [0, 2, 2, 2, 0, 0], fingers: [0, 1, 2, 3, 0, 0], position: 1 },
};

function fromTemplate(root: Root, tmpl: Tmpl): ChordShape {
  const openPc = tmpl.rootString === 6 ? PC.E : PC.A;
  const R = (PC[root] - openPc + 12) % 12; // barre fret (0 = open position)
  const frets = tmpl.offsets.map((o) => (o === "x" ? -1 : R + o));
  const played = frets.filter((f) => f > 0);
  const hasOpen = frets.some((f) => f === 0);
  const minF = played.length ? Math.min(...played) : 0;
  const position = hasOpen || minF <= 1 ? 1 : minF;
  const shape: ChordShape = { frets, fingers: tmpl.fingers.slice(), position };
  if (tmpl.barre && R > 0) {
    shape.barre = { fret: R, from: tmpl.rootString === 6 ? 0 : 1, to: 5 };
  }
  return shape;
}

/** Resolve the best shape for a (root, type) pair. */
export function getChord(root: Root, type: ChordType): ChordShape {
  const open = OPEN[`${root}:${type}`];
  if (open) return open;

  // A-only template types.
  if (type === "sus2" || type === "add9" || type === "dim") {
    return fromTemplate(root, A[type]);
  }

  // Pick the shape that sits lower on the neck (smaller barre fret).
  const e = E[type] ? fromTemplate(root, E[type]) : null;
  const a = A[type] ? fromTemplate(root, A[type]) : null;
  if (e && a) return a.position <= e.position ? a : e;
  return (e ?? a)!;
}

/** Display name, e.g. "C", "Am", "F#maj7". */
export function chordName(root: Root, type: ChordType): string {
  const suffix = CHORD_TYPES.find((t) => t.key === type)?.suffix ?? "";
  return `${ROOT_SHORT[root]}${suffix}`;
}

/** MIDI notes for the sounding strings of a shape (low → high), for playback. */
export function chordMidi(shape: ChordShape): number[] {
  const out: number[] = [];
  shape.frets.forEach((f, i) => {
    if (f >= 0) out.push(STRING_MIDI[i] + f);
  });
  return out;
}

/** True when the fretted note on string `i` is the chord root (for highlighting). */
export function isRootNote(rootPc: number, stringIndex: number, fret: number): boolean {
  if (fret < 0) return false;
  return (STRING_MIDI[stringIndex] + fret) % 12 === rootPc;
}

export const rootPc = (root: Root): number => PC[root];
