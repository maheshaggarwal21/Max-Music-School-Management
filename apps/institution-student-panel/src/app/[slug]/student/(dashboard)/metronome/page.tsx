"use client";
import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Minus, Pause, Play, Plus, Sparkles } from "lucide-react";
import { BlurFade, BorderBeam, GradientText, ShinyText, SpotlightCard, cn } from "@maxmusic/ui";

import { click, getAudioContext } from "@/lib/audio";

const MIN_BPM = 40;
const MAX_BPM = 240;

const SIGNATURES: { label: string; beats: number }[] = [
  { label: "2/4", beats: 2 },
  { label: "3/4", beats: 3 },
  { label: "4/4", beats: 4 },
  { label: "6/8", beats: 6 },
  { label: "7/4", beats: 7 },
];

const TIPS = [
  "Slow is smooth, and smooth is fast.",
  "Practice with the click until it disappears underneath you.",
  "Nail it slow before you take it fast.",
  "Subdivide the beat in your head — feel the space between clicks.",
  "Tempo is a skill. Train it like one.",
];

function tempoName(bpm: number): string {
  if (bpm < 60) return "Largo";
  if (bpm < 76) return "Adagio";
  if (bpm < 108) return "Andante";
  if (bpm < 120) return "Moderato";
  if (bpm < 168) return "Allegro";
  return "Presto";
}

export default function MetronomePage() {
  const [bpm, setBpm] = useState(80);
  const [beats, setBeats] = useState(4);
  const [playing, setPlaying] = useState(false);
  const [activeBeat, setActiveBeat] = useState(-1);
  const [tip] = useState(() => TIPS[0]);

  // Scheduler state lives in refs so the rAF/interval loops always read fresh
  // values without re-subscribing.
  const bpmRef = useRef(bpm);
  const beatsRef = useRef(beats);
  const nextNoteRef = useRef(0);
  const beatNumRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const queueRef = useRef<{ beat: number; time: number }[]>([]);

  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);
  useEffect(() => {
    beatsRef.current = beats;
  }, [beats]);

  const stop = useCallback(() => {
    if (timerRef.current != null) window.clearInterval(timerRef.current);
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    timerRef.current = null;
    rafRef.current = null;
    queueRef.current = [];
    setPlaying(false);
    setActiveBeat(-1);
  }, []);

  const start = useCallback(() => {
    const audio = getAudioContext();
    if (!audio) return;
    beatNumRef.current = 0;
    nextNoteRef.current = audio.currentTime + 0.06;
    queueRef.current = [];

    // Lookahead scheduler: enqueue clicks ~0.1s ahead every 25ms.
    timerRef.current = window.setInterval(() => {
      const secondsPerBeat = 60 / bpmRef.current;
      while (nextNoteRef.current < audio.currentTime + 0.1) {
        const beat = beatNumRef.current % beatsRef.current;
        click(audio, nextNoteRef.current, beat === 0);
        queueRef.current.push({ beat, time: nextNoteRef.current });
        nextNoteRef.current += secondsPerBeat;
        beatNumRef.current += 1;
      }
    }, 25);

    // Drive the on-screen beat indicator off the audio clock.
    const tick = () => {
      const now = audio.currentTime;
      while (queueRef.current.length && queueRef.current[0].time <= now) {
        setActiveBeat(queueRef.current.shift()!.beat);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    setPlaying(true);
  }, []);

  const toggle = useCallback(() => {
    if (playing) stop();
    else start();
  }, [playing, start, stop]);

  // Clean up on unmount.
  useEffect(() => () => stop(), [stop]);

  // Spacebar play/pause.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  const clamp = (v: number) => Math.min(MAX_BPM, Math.max(MIN_BPM, v));
  const pct = ((bpm - MIN_BPM) / (MAX_BPM - MIN_BPM)) * 100;

  return (
    <div className="relative flex flex-col gap-6 p-4 md:p-6">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute left-1/2 top-0 h-[300px] w-[500px] -translate-x-1/2 rounded-full opacity-[0.04] blur-[100px]"
          style={{ backgroundColor: "var(--brand-primary)" }}
        />
      </div>

      <BlurFade delay={0}>
        <div>
          <GradientText className="text-2xl font-bold">Metronome</GradientText>
          <ShinyText text="Lock in your timing — your precision engine" speed={6} className="mt-1 text-sm" />
        </div>
      </BlurFade>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* ── Big BPM dial ── */}
        <BlurFade delay={0.1}>
          <SpotlightCard className="relative flex flex-col items-center overflow-hidden rounded-3xl border border-border bg-card px-6 py-10">
            <BorderBeam size={70} duration={9} />
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-brand">
              Beats per minute
            </p>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-7xl font-black leading-none tabular-nums md:text-8xl">
                {bpm}
              </span>
            </div>
            <p className="mt-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              <span className={cn("h-1.5 w-1.5 rounded-full bg-brand", playing && "animate-pulse")} />
              {tempoName(bpm)}
            </p>

            {/* Play / pause */}
            <button
              type="button"
              onClick={toggle}
              aria-label={playing ? "Stop metronome" : "Start metronome"}
              className="group mt-8 flex h-20 w-20 items-center justify-center rounded-2xl text-white shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
              style={{
                background:
                  "linear-gradient(135deg, var(--brand-primary-light), var(--brand-primary-deep))",
                boxShadow: "var(--glow-primary-lg)",
              }}
            >
              {playing ? (
                <Pause className="h-8 w-8 fill-current" />
              ) : (
                <Play className="h-8 w-8 translate-x-0.5 fill-current" />
              )}
            </button>

            {/* Beat indicator */}
            <div className="mt-8 flex items-center gap-2">
              {Array.from({ length: beats }, (_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-2.5 rounded-full transition-all duration-100",
                    i === 0 ? "w-6" : "w-5",
                    activeBeat === i
                      ? "scale-110 bg-brand shadow-[var(--glow-primary-sm)]"
                      : "bg-muted"
                  )}
                />
              ))}
            </div>

            {/* Pro tip */}
            <div
              className="mt-9 w-full max-w-sm rounded-2xl p-4 text-white"
              style={{
                background:
                  "linear-gradient(135deg, var(--brand-primary), var(--brand-primary-deep))",
              }}
            >
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 shrink-0" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/80">
                    Pro tip
                  </p>
                  <p className="mt-0.5 text-sm font-medium italic">&ldquo;{tip}&rdquo;</p>
                </div>
              </div>
            </div>
          </SpotlightCard>
        </BlurFade>

        {/* ── Controls ── */}
        <div className="flex flex-col gap-4">
          <BlurFade delay={0.2}>
            <SpotlightCard className="relative overflow-hidden rounded-2xl border border-border bg-card p-5">
              <BorderBeam size={40} duration={12} />
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold uppercase tracking-wide">Speed</p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label="Slower"
                    onClick={() => setBpm((b) => clamp(b - 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-muted transition-colors hover:bg-brand/15 hover:text-brand"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Faster"
                    onClick={() => setBpm((b) => clamp(b + 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-muted transition-colors hover:bg-brand/15 hover:text-brand"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <input
                type="range"
                min={MIN_BPM}
                max={MAX_BPM}
                value={bpm}
                onChange={(e) => setBpm(clamp(Number(e.target.value)))}
                aria-label="Tempo in beats per minute"
                className="mt-5 h-2 w-full cursor-pointer appearance-none rounded-full outline-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand [&::-webkit-slider-thumb]:shadow-[var(--glow-primary-sm)] [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-brand"
                style={{
                  background: `linear-gradient(to right, var(--brand-primary) ${pct}%, var(--color-muted, #e5e7eb) ${pct}%)`,
                }}
              />
              <div className="mt-2 flex justify-between text-[10px] font-medium text-muted-foreground">
                <span>{MIN_BPM}</span>
                <span>{MAX_BPM}</span>
              </div>
            </SpotlightCard>
          </BlurFade>

          <BlurFade delay={0.3}>
            <SpotlightCard className="relative overflow-hidden rounded-2xl border border-border bg-card p-5">
              <BorderBeam size={40} duration={12} delay={2} />
              <p className="text-sm font-bold uppercase tracking-wide">Time signature</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {SIGNATURES.map((s) => {
                  const active = s.beats === beats;
                  return (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => {
                        setBeats(s.beats);
                        if (playing) beatNumRef.current = 0;
                      }}
                      className={cn(
                        "min-w-[58px] rounded-xl px-4 py-2.5 text-sm font-bold tabular-nums transition-all",
                        active
                          ? "bg-foreground text-background shadow-sm"
                          : "bg-muted text-muted-foreground hover:bg-brand/10 hover:text-brand"
                      )}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                The first beat of every bar is accented — count it as &ldquo;1&rdquo;.
              </p>
            </SpotlightCard>
          </BlurFade>
        </div>
      </div>
    </div>
  );
}
