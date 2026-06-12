"use client";
import * as React from "react";
import { cn } from "@maxmusic/ui";

import { isRootNote, type ChordShape } from "@/lib/chords";

const STRINGS = 6;
const FRETS = 5; // visible fret window

/**
 * SVG guitar-chord diagram. Strings run vertically (6th → 1st, left → right),
 * frets horizontally. Open/muted markers sit above the nut; finger dots show
 * the finger number; the chord root is highlighted in the brand color.
 */
export function ChordDiagram({
  shape,
  rootPc,
  size = 132,
  className,
}: {
  shape: ChordShape;
  rootPc: number;
  size?: number;
  className?: string;
}) {
  const padX = size * 0.16;
  const padTop = size * 0.2;
  const w = size;
  const h = size * 1.06;
  const gridW = w - padX * 2;
  const gridH = h - padTop - size * 0.1;
  const colGap = gridW / (STRINGS - 1);
  const rowGap = gridH / FRETS;

  const showNut = shape.position <= 1;
  const x = (s: number) => padX + s * colGap;
  const y = (row: number) => padTop + row * rowGap; // row 0 = nut line

  const dotR = colGap * 0.32;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={size}
      height={size * 1.06}
      className={cn("select-none", className)}
      role="img"
    >
      {/* Position marker for barre/up-the-neck chords */}
      {!showNut && (
        <text
          x={padX - colGap * 0.55}
          y={y(0.95)}
          textAnchor="end"
          className="fill-brand"
          style={{ fontSize: size * 0.11, fontWeight: 700 }}
        >
          {shape.position}
        </text>
      )}

      {/* Frets */}
      {Array.from({ length: FRETS + 1 }, (_, r) => (
        <line
          key={`f${r}`}
          x1={x(0)}
          y1={y(r)}
          x2={x(STRINGS - 1)}
          y2={y(r)}
          className="stroke-border"
          strokeWidth={r === 0 && showNut ? 3.5 : 1}
          strokeLinecap="round"
        />
      ))}

      {/* Strings */}
      {Array.from({ length: STRINGS }, (_, s) => (
        <line
          key={`s${s}`}
          x1={x(s)}
          y1={y(0)}
          x2={x(s)}
          y2={y(FRETS)}
          className="stroke-border"
          strokeWidth={1}
          strokeLinecap="round"
        />
      ))}

      {/* Open (O) / muted (X) markers above the nut */}
      {shape.frets.map((f, s) => {
        if (f > 0) return null;
        const cx = x(s);
        const cy = padTop - size * 0.07;
        if (f === 0) {
          return (
            <circle
              key={`o${s}`}
              cx={cx}
              cy={cy}
              r={dotR * 0.62}
              fill="none"
              className="stroke-muted-foreground"
              strokeWidth={1.5}
            />
          );
        }
        return (
          <g key={`x${s}`} className="stroke-muted-foreground" strokeWidth={1.6} strokeLinecap="round">
            <line x1={cx - dotR * 0.5} y1={cy - dotR * 0.5} x2={cx + dotR * 0.5} y2={cy + dotR * 0.5} />
            <line x1={cx - dotR * 0.5} y1={cy + dotR * 0.5} x2={cx + dotR * 0.5} y2={cy - dotR * 0.5} />
          </g>
        );
      })}

      {/* Barre */}
      {shape.barre && (
        <rect
          x={x(shape.barre.from) - dotR}
          y={y(shape.barre.fret - shape.position + 0.5) - dotR}
          width={x(shape.barre.to) - x(shape.barre.from) + dotR * 2}
          height={dotR * 2}
          rx={dotR}
          className="fill-foreground"
        />
      )}

      {/* Finger dots */}
      {shape.frets.map((f, s) => {
        if (f <= 0) return null;
        const row = f - shape.position + 0.5;
        if (row < 0 || row > FRETS) return null;
        const root = isRootNote(rootPc, s, f);
        const finger = shape.fingers[s];
        return (
          <g key={`d${s}`}>
            <circle
              cx={x(s)}
              cy={y(row)}
              r={dotR}
              className={root ? "fill-brand" : "fill-foreground"}
            />
            {finger > 0 && (
              <text
                x={x(s)}
                y={y(row)}
                textAnchor="middle"
                dominantBaseline="central"
                fill="white"
                style={{ fontSize: dotR * 1.1, fontWeight: 700 }}
              >
                {finger}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
