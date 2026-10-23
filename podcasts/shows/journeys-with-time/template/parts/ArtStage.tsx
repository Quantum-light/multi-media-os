// Art plates: full-frame AI loops behind the science line work. Each shot's plate fades in over the last,
// with a slow camera push. The lower part darkens so captions always read.
import React from "react";
import { AbsoluteFill, OffthreadVideo, Img, Sequence, staticFile, useCurrentFrame } from "remotion";
import { C } from "../brand";
import type { Shot } from "./Stage";

const XF = 15;

const Plate: React.FC<{ src: string; len: number }> = ({ src, len }) => {
  const f = useCurrentFrame();
  const opacity = Math.min(1, f / XF);
  const scale = 1.04 + (f / Math.max(len, 1)) * 0.06;
  // The grade pulls generated art towards regal night purple and platinum (less pink, less saturated).
  const style = { width: "100%", height: "100%", objectFit: "cover" as const, transform: `scale(${scale})`,
    filter: "saturate(0.85) brightness(0.92) contrast(1.04)" };
  return (
    <AbsoluteFill style={{ opacity }}>
      {src.endsWith(".mp4") ? <OffthreadVideo src={staticFile(src)} muted style={style} /> : <Img src={staticFile(src)} style={style} />}
    </AbsoluteFill>
  );
};

export const ArtStage: React.FC<{ shots: Shot[]; total: number; fade: number }> = ({ shots, total, fade }) => (
  <AbsoluteFill style={{ opacity: 1 - fade * 0.55 }}>
    {shots.map((s, i) => {
      if (!s.art) return null;
      const end = i + 1 < shots.length ? shots[i + 1].from + XF : total;
      return (
        <Sequence key={i} from={s.from} durationInFrames={Math.max(1, end - s.from)}>
          <Plate src={s.art} len={end - s.from} />
        </Sequence>
      );
    })}
    <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(21,10,38,0.35) 0%, transparent 18%, transparent 48%, rgba(21,10,38,0.82) 66%, ${C.night} 92%)` }} />
  </AbsoluteFill>
);
