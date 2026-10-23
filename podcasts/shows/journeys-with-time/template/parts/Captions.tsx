// Crimson Pro captions, 3-5 words at a time. The spoken word turns gold;
// words still to come wait at 40%. Chunks fade in over 0.2 s. Never bounce or pop.
import React from "react";
import { interpolate } from "remotion";
import { C, ZONE, W, crimson, type Word } from "../brand";

type Chunk = { words: Word[]; start: number; end: number };

export function chunk(words: Word[]): Chunk[] {
  const out: Chunk[] = [];
  let cur: Word[] = [];
  const flush = () => { if (cur.length) out.push({ words: cur, start: cur[0].start, end: cur[cur.length - 1].end }); cur = []; };
  words.forEach((w, i) => {
    const prev = words[i - 1];
    const chars = cur.reduce((n, x) => n + x.text.length + 1, 0) + w.text.length;
    if (cur.length && (cur.length >= 5 || chars > 28 || (prev && w.start - prev.end > 380) || (cur.length >= 3 && /[,;:]$/.test(prev.text)))) flush();
    cur.push(w);
    if (/[.?!]$/.test(w.text)) flush();
  });
  flush();
  // Each chunk stays until the next one begins (or a beat after its last word).
  return out.map((c, i) => ({ ...c, end: out[i + 1] ? out[i + 1].start : c.end + 500 }));
}

export const Captions: React.FC<{ chunks: Chunk[]; ms: number; hide: number }> = ({ chunks, ms, hide }) => {
  const c = chunks.find((x) => ms >= x.start - 60 && ms < x.end);
  if (!c || hide >= 1) return null;
  const fadeIn = interpolate(ms, [c.start - 60, c.start + 140], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{
      position: "absolute", left: ZONE.left, width: W - ZONE.left - ZONE.right, top: ZONE.captionsTop,
      height: ZONE.captionsBottom - ZONE.captionsTop - 40, display: "flex", alignItems: "center", justifyContent: "center",
      textAlign: "center", fontFamily: crimson, fontWeight: 500, fontSize: 80, lineHeight: 1.16, color: C.bright,
      opacity: fadeIn * (1 - hide),
    }}>
      <div>
        {c.words.map((w, i) => {
          const spoken = ms >= w.start;
          const active = spoken && (i === c.words.length - 1 ? ms < c.end : ms < c.words[i + 1].start);
          return (
            <span key={i} style={{
              color: active ? C.gold : C.bright,
              opacity: spoken ? 1 : 0.4,
              textShadow: active ? "0 0 36px rgba(217,168,78,0.55)" : "0 2px 24px rgba(21,10,38,0.9)",
            }}>{w.text}{i < c.words.length - 1 ? " " : ""}</span>
          );
        })}
      </div>
    </div>
  );
};
