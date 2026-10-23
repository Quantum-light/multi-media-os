// Field Notes layer: the podcast lockup (inside the platform safe zone), figure note, corner brackets
// round the captions, and a gold waveform of the voice that fills as the clip plays.
import React from "react";
import { staticFile } from "remotion";
import { useAudioData, getWaveformPortion } from "@remotion/media-utils";
import { C, ZONE, W, cinzel, crimson } from "../brand";

const Corner: React.FC<{ x: "left" | "right"; y: "top" | "bottom" }> = ({ x, y }) => (
  <div style={{
    position: "absolute", [x]: 0, [y]: 0, width: 32, height: 32,
    [`border${x === "left" ? "Left" : "Right"}`]: `2px solid ${C.platinum}`,
    [`border${y === "top" ? "Top" : "Bottom"}`]: `2px solid ${C.platinum}`,
    opacity: 0.7,
  }} />
);

const BARS = 56;
const Waveform: React.FC<{ audio: string; progress: number; width: number }> = ({ audio, progress, width }) => {
  const data = useAudioData(staticFile(audio));
  if (!data) return null;
  const bars = getWaveformPortion({ audioData: data, startTimeInSeconds: 0, durationInSeconds: data.durationInSeconds, numberOfSamples: BARS });
  const peak = Math.max(0.0001, ...bars.map((b) => b.amplitude));
  const step = width / BARS;
  return (
    <div style={{ position: "absolute", left: ZONE.left, top: ZONE.thread - 6, width, height: 52, display: "flex", alignItems: "center" }}>
      {bars.map((b, i) => (
        <div key={i} style={{ width: step - 6, marginRight: 6, height: 4 + (b.amplitude / peak) * 44, borderRadius: 2,
          background: i / BARS <= progress ? C.gold : C.soft, opacity: i / BARS <= progress ? 0.95 : 0.3 }} />
      ))}
    </div>
  );
};

export const FieldNotes: React.FC<{ n: number; total: number; progress: number; show: number; audio: string; episode?: string }> = ({ n, total, progress, show, audio, episode }) => {
  const top = ZONE.captionsTop - 20;
  const height = ZONE.captionsBottom - ZONE.captionsTop - 40;
  const width = W - ZONE.left - ZONE.right;
  return (
    <>
      <div style={{ position: "absolute", top: ZONE.label, left: ZONE.left, right: ZONE.left, textAlign: "center",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <div style={{ fontFamily: cinzel, fontWeight: 500, fontSize: 34, letterSpacing: "0.26em", color: C.bright }}>JOURNEYS WITH TIME</div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", flexWrap: "wrap", columnGap: 14, rowGap: 2, maxWidth: 880 }}>
          <span style={{ fontFamily: cinzel, fontSize: 22, letterSpacing: "0.32em", color: C.gold }}>PODCAST</span>
          <span style={{ fontFamily: crimson, fontStyle: "italic", fontSize: 28, color: C.soft }}>
            {episode ? `${episode} by Grace Gold` : "by Grace Gold"}
          </span>
        </div>
      </div>
      <div style={{ opacity: show }}>
        <div style={{ position: "absolute", left: ZONE.left, top: top - 52, fontFamily: crimson, fontStyle: "italic",
          fontSize: 30, color: C.soft }}>note {String(n).padStart(2, "0")} / {String(total).padStart(2, "0")}</div>
        <div style={{ position: "absolute", left: ZONE.left, top, width, height: height + 40 }}>
          <Corner x="left" y="top" /><Corner x="right" y="top" /><Corner x="left" y="bottom" /><Corner x="right" y="bottom" />
        </div>
        {audio ? <Waveform audio={audio} progress={progress} width={width} /> : (
          <div style={{ position: "absolute", left: ZONE.left, width: width * progress, top: ZONE.thread + 20, height: 2, background: C.gold }} />
        )}
      </div>
    </>
  );
};
