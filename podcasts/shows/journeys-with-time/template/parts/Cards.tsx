// Title card (opens the clip in stillness) and end frame (points to the full episode).
import React from "react";
import { C, ZONE, cinzel, crimson } from "../brand";

const rule = <div style={{ width: 128, height: 2, background: C.gold, margin: "0 auto" }} />;

export const TitleCard: React.FC<{ title: string; opacity: number }> = ({ title, opacity }) => (
  <div style={{ position: "absolute", left: 96, right: 96, top: ZONE.captionsTop - 40, opacity,
    display: "flex", flexDirection: "column", alignItems: "center", gap: 36, textAlign: "center" }}>
    <div style={{ fontFamily: cinzel, fontWeight: 500, fontSize: 84, lineHeight: 1.12, letterSpacing: "0.06em",
      color: C.bright, textTransform: "uppercase" }}>{title}</div>
    {rule}
  </div>
);

export const EndFrame: React.FC<{ opacity: number }> = ({ opacity }) => (
  <div style={{ position: "absolute", left: 96, right: 96, top: 1000, opacity,
    display: "flex", flexDirection: "column", alignItems: "center", gap: 48, textAlign: "center" }}>
    <div style={{ fontFamily: crimson, fontStyle: "italic", fontSize: 76, lineHeight: 1.2, color: C.bright }}>
      The rest of the journey<br />is waiting.
    </div>
    {rule}
    <div style={{ fontFamily: cinzel, fontWeight: 500, fontSize: 60, letterSpacing: "0.12em", lineHeight: 1.2, color: C.bright }}>
      JOURNEYS<br />WITH TIME
    </div>
    <div style={{ fontFamily: crimson, fontSize: 42, lineHeight: 1.4, color: "#DCD6E6" }}>
      Full episode on Spotify<br />and all podcast apps
    </div>
  </div>
);
