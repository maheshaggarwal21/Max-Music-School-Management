"use client";
import * as React from "react";
import { useMemo, useState } from "react";
import { Search, Volume2, ZoomIn } from "lucide-react";
import { BlurFade, BorderBeam, GradientText, Modal, ShinyText, SpotlightCard, cn } from "@maxmusic/ui";

import { playChord } from "@/lib/audio";
import {
  CHORD_TYPES,
  ROOTS,
  ROOT_LABEL,
  ROOT_SHORT,
  chordMidi,
  chordName,
  getChord,
  rootPc,
  type ChordType,
  type Root,
} from "@/lib/chords";
import { useStudent } from "@/components/student-provider";
import { ChordDiagram } from "@/components/chord-diagram";

export default function ChordsPage() {
  const { student } = useStudent();
  const [root, setRoot] = useState<Root>("C");
  const [zoom, setZoom] = useState<{ root: Root; type: ChordType } | null>(null);

  const cards = useMemo(
    () =>
      CHORD_TYPES.map((t) => ({
        type: t.key as ChordType,
        label: t.label,
        shape: getChord(root, t.key as ChordType),
      })),
    [root]
  );

  const pc = rootPc(root);
  const firstName = student?.name.split(" ")[0];

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
          <GradientText className="text-2xl font-bold">Guitar Chords</GradientText>
          <ShinyText
            text={
              firstName
                ? `Ready to level up your playing, ${firstName}?`
                : "Your interactive chord library"
            }
            speed={6}
            className="mt-1 text-sm"
          />
        </div>
      </BlurFade>

      {/* Root selector */}
      <BlurFade delay={0.1}>
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
          <span className="mr-1 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Search className="h-3.5 w-3.5" />
            Root
          </span>
          {ROOTS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRoot(r)}
              title={ROOT_LABEL[r]}
              className={cn(
                "min-w-[44px] rounded-xl px-3 py-2 text-sm font-bold transition-all",
                r === root
                  ? "bg-foreground text-background shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-brand/10 hover:text-brand"
              )}
            >
              {ROOT_SHORT[r]}
            </button>
          ))}
        </div>
      </BlurFade>

      <BlurFade delay={0.15}>
        <p className="text-sm font-semibold text-muted-foreground">
          {ROOT_LABEL[root]} chords
        </p>
      </BlurFade>

      {/* Chord grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cards.map((c, i) => (
          <BlurFade key={c.type} delay={0.18 + i * 0.03}>
            <SpotlightCard className="group relative flex h-full flex-col items-center overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all duration-300 hover:-translate-y-0.5">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand">
                {c.label}
              </p>
              <p className="mt-1 text-2xl font-black">{chordName(root, c.type)}</p>

              <div className="mt-3">
                <ChordDiagram shape={c.shape} rootPc={pc} size={140} />
              </div>

              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => playChord(chordMidi(c.shape))}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-colors hover:border-brand/50 hover:bg-brand/10 hover:text-brand"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  Play
                </button>
                <button
                  type="button"
                  onClick={() => setZoom({ root, type: c.type })}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-colors hover:border-brand/50 hover:bg-brand/10 hover:text-brand"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                  Zoom
                </button>
              </div>

              <span className="mt-3 rounded-full bg-muted px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Pos {c.shape.position}
              </span>
            </SpotlightCard>
          </BlurFade>
        ))}
      </div>

      {/* Zoom modal */}
      <Modal
        open={!!zoom}
        onClose={() => setZoom(null)}
        title={zoom ? chordName(zoom.root, zoom.type) : ""}
        subtitle={
          zoom
            ? `${ROOT_LABEL[zoom.root]} · ${CHORD_TYPES.find((t) => t.key === zoom.type)?.label}`
            : undefined
        }
      >
        {zoom && (
          <div className="flex flex-col items-center gap-5 py-2">
            <ChordDiagram shape={getChord(zoom.root, zoom.type)} rootPc={rootPc(zoom.root)} size={260} />
            <button
              type="button"
              onClick={() => playChord(chordMidi(getChord(zoom.root, zoom.type)))}
              className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-2.5 text-sm font-bold uppercase tracking-wider text-white shadow-sm transition-transform hover:scale-[1.03]"
            >
              <Volume2 className="h-4 w-4" />
              Play chord
            </button>
            <div className="flex items-center gap-5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-brand" /> Root note
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-foreground" /> Other notes
              </span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
