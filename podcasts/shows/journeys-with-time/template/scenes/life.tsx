// Scenes about people and life: a figure of light, coherence pulse, waves, lattice, network, horizon, keyword.
import React from "react";
import { C, cinzel, crimson } from "../brand";
import { type SceneProps, dotted, line, ease, pts } from "./kit";

// A standing human figure sampled as points of light.
const BODY = pts(460, "body", (i, r) => {
  const u = r("u"), v = r("v"), j = () => (r("j") - 0.5) * 14;
  const part = i % 10;
  if (part < 2) { const a = u * Math.PI * 2, rr = 52 * Math.sqrt(v); return [Math.cos(a) * rr, -300 + Math.sin(a) * rr * 1.15]; }
  if (part < 6) { const y = -230 + u * 270, w = 78 - Math.abs(y + 120) * 0.12; return [(v - 0.5) * 2 * w, y + j()]; }
  if (part < 8) { const s = u > 0.5 ? 1 : -1, k = v; return [s * (82 + k * 70) + j(), -200 + k * 240 + j()]; }
  const s = u > 0.5 ? 1 : -1, k = v; return [s * (34 + k * 30) + j(), 40 + k * 320];
});
export const Figure: React.FC<SceneProps> = ({ t, p }) => (
  <g opacity={ease(p * 1.3)}>
    <circle cy={-120} r={160} fill={C.orchid} opacity={0.22} filter="url(#bloom)" />
    {BODY.map(([x, y], i) => {
      const drift = Math.sin(t * 1.2 + i) * 3;
      return <circle key={i} cx={x + drift} cy={y + Math.cos(t + i) * 2} r={i % 4 ? 2.6 : 3.6} fill={C.platinum} opacity={0.5 + 0.5 * Math.abs(Math.sin(t * 0.8 + i * 0.3))} />;
    })}
    <circle cy={-140} r={12 + 4 * Math.sin(t * 2.4)} fill={C.gold} />
    <circle cy={-140} r={40 + 10 * Math.sin(t * 2.4)} fill={C.gold} opacity={0.15} filter="url(#bloom)" />
  </g>
);

export const Pulse: React.FC<SceneProps> = ({ t, p }) => (
  <g opacity={ease(p * 1.5)}>
    {Array.from({ length: 6 }, (_, k) => {
      const r = (t * 90 + k * 78) % 470;
      return <circle key={k} r={r} {...dotted(14, 4)} opacity={(1 - r / 470) * 0.9} />;
    })}
    <circle r={150} fill={C.orchid} opacity={0.25} filter="url(#bloom)" />
    <circle r={16 + 5 * Math.sin(t * 3)} fill={C.gold} />
  </g>
);

export const Waves: React.FC<SceneProps> = ({ t, p }) => (
  <g opacity={ease(p * 1.4)}>
    {Array.from({ length: 6 }, (_, k) => {
      const amp = 40 + k * 18, f = 0.012 - k * 0.0012, ph = t * (1.2 + k * 0.15) + k;
      const d = Array.from({ length: 91 }, (_, i) => { const x = -450 + i * 10; return `${i ? "L" : "M"} ${x} ${Math.sin(x * f + ph) * amp * ease(p * 1.5) + (k - 2.5) * 44}`; }).join(" ");
      return <path key={k} d={d} {...line(k === 3 ? 1 : 0.45, k === 3 ? 3 : 1.6)} stroke={k === 3 ? C.gold : C.platinum} />;
    })}
  </g>
);

const LATTICE = (() => { const out: [number, number][] = []; for (let r = -6; r <= 6; r++) for (let q = -7; q <= 7; q++) { const x = q * 62 + (r % 2 ? 31 : 0), y = r * 54; if (x * x + y * y < 380 * 380) out.push([x, y]); } return out; })();
export const Lattice: React.FC<SceneProps> = ({ t, p }) => {
  const sx = Math.cos(t * 0.3);
  return (
    <g opacity={ease(p * 1.4)} transform={`scale(${0.75 + 0.25 * Math.abs(sx)},1)`}>
      {LATTICE.map(([x, y], i) => {
        const wave = 0.5 + 0.5 * Math.sin(t * 3 - Math.hypot(x, y) * 0.02);
        return <circle key={i} cx={x} cy={y} r={4 + wave * 4} fill={wave > 0.93 ? C.gold : C.platinum} opacity={0.35 + wave * 0.65} />;
      })}
    </g>
  );
};

const NODES = pts(34, "net", (i, r) => { const a = r("a") * Math.PI * 2, rr = 60 + Math.sqrt(r("r")) * 330; return [Math.cos(a) * rr, Math.sin(a) * rr]; });
const EDGES = NODES.flatMap((a, i) => NODES.slice(i + 1).map((b, k) => [i, i + 1 + k, Math.hypot(a[0] - b[0], a[1] - b[1])] as const)).filter((e) => e[2] < 170);
export const Network: React.FC<SceneProps> = ({ t, p }) => (
  <g opacity={ease(p * 1.3)}>
    {EDGES.map(([a, b], i) => <line key={i} x1={NODES[a][0]} y1={NODES[a][1]} x2={NODES[b][0]} y2={NODES[b][1]} {...line(0.35 * ease(p * 2 - (i % 10) / 10), 1.4)} />)}
    {NODES.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i === 7 ? 11 : 6 + 2 * Math.sin(t * 2 + i)} fill={i === 7 ? C.gold : C.platinum} />)}
  </g>
);

export const Horizon: React.FC<SceneProps> = ({ t, p }) => (
  <g opacity={ease(p * 1.3)}>
    <defs><radialGradient id="dawn" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor={C.dawn} stopOpacity={0.55} /><stop offset="100%" stopColor={C.dawn} stopOpacity={0} /></radialGradient></defs>
    <ellipse cx={0} cy={200} rx={760} ry={260} fill="url(#dawn)" />
    <line x1={-600} y1={200} x2={600} y2={200} stroke={C.dawn} strokeWidth={2} opacity={0.6} />
    <rect x={-600} y={200} width={1200} height={300} fill={C.night} opacity={0.85} />
    <circle cy={-140 - t * 4} r={112} fill="none" stroke={C.dawn} strokeWidth={10} opacity={0.6} filter="url(#bloom)" />
    <circle cy={-140 - t * 4} r={108} fill={C.night} stroke="#F1D49A" strokeWidth={2} />
    <g transform="translate(110,200) scale(1.6)">
      <circle cx={0} cy={-38} r={6} fill={C.night} />
      <path d="M -7 -30 L 7 -30 L 8 -8 L 4 -8 L 4 0 L 1 0 L 1 -6 L -1 -6 L -1 0 L -4 0 L -4 -8 L -8 -8 Z" fill={C.night} />
    </g>
  </g>
);

export const Keyword: React.FC<SceneProps> = ({ t, p, label = "" }) => {
  const size = label.length > 16 ? 58 : label.length > 10 ? 72 : 88;
  return (
    <g opacity={ease(p * 1.6)}>
      <circle r={330} {...dotted(16, 3.5)} opacity={0.5} transform={`rotate(${t * 6})`} />
      <circle r={250} {...line(0.25, 1.2)} />
      <text textAnchor="middle" y={size * 0.35} fill={C.bright} fontFamily={cinzel} fontWeight={500} fontSize={size} letterSpacing="0.06em">{label.toUpperCase()}</text>
      <line x1={-60} y1={size * 0.35 + 46} x2={60} y2={size * 0.35 + 46} stroke={C.gold} strokeWidth={2.5} />
    </g>
  );
};
