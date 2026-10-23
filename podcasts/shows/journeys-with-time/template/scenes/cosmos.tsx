// Scenes about the universe: light sphere, orbits, spiral galaxy, bending spacetime, a first bloom of light.
import React from "react";
import { C } from "../brand";
import { type SceneProps, dotted, line, ease, pts } from "./kit";

const Bloom: React.FC<{ r?: number; o?: number }> = ({ r = 150, o = 0.32 }) => (
  <>
    <circle r={r} fill={C.orchid} opacity={o} filter="url(#bloom)" />
    <circle r={r * 0.22} fill="#FFFFFF" opacity={0.9} filter="url(#bloom)" />
    <circle r={r * 0.06} fill="#FFFFFF" />
  </>
);

export const Sphere: React.FC<SceneProps> = ({ t, p }) => {
  const R = 300, spin = t * 0.25;
  const merid = Array.from({ length: 6 }, (_, k) => R * Math.abs(Math.cos((k * Math.PI) / 6 + spin)));
  const lats = [-60, -30, 0, 30, 60].map((d) => (d * Math.PI) / 180);
  return (
    <g opacity={ease(p * 1.3)} transform={`scale(${0.9 + 0.1 * ease(p)})`}>
      <Bloom />
      <circle r={R} {...dotted(18, 4.6)} opacity={0.9} />
      {merid.map((rx, k) => <ellipse key={k} rx={Math.max(rx, 2)} ry={R} {...dotted(18, 4)} opacity={0.35 + 0.45 * (rx / R)} />)}
      {lats.map((a, k) => <ellipse key={`l${k}`} cy={-R * Math.sin(a)} rx={R * Math.cos(a)} ry={R * Math.cos(a) * 0.2} {...dotted(18, 3.6)} opacity={0.55} />)}
      <g transform={`rotate(${-18 + t * 2})`}>
        <ellipse rx={440} ry={120} {...line(0.32, 1.4)} />
        <circle cx={440 * Math.cos(t * 0.6)} cy={120 * Math.sin(t * 0.6)} r={7} fill={C.gold} />
      </g>
    </g>
  );
};

export const Orbits: React.FC<SceneProps> = ({ t, p }) => {
  const orbits = [130, 210, 300, 400];
  return (
    <g opacity={ease(p * 1.3)} transform="rotate(-12)">
      <Bloom r={110} o={0.4} />
      {orbits.map((r, i) => {
        const a = t * (0.9 - i * 0.18) + i * 1.7;
        return (
          <g key={r}>
            <ellipse rx={r} ry={r * 0.32} {...line(0.4, 1.4)} />
            <circle cx={r * Math.cos(a)} cy={r * 0.32 * Math.sin(a)} r={i === 2 ? 11 : 7} fill={i === 2 ? C.gold : C.platinum} />
          </g>
        );
      })}
    </g>
  );
};

const STARS = pts(520, "galaxy", (i, r) => {
  const arm = i % 2, rad = 18 + i * 0.75 + r("j") * 30;
  return [rad, rad * 0.016 + arm * Math.PI + (r("a") - 0.5) * 0.5];
});
export const Galaxy: React.FC<SceneProps> = ({ t, p }) => (
  <g opacity={ease(p * 1.3)}>
    <Bloom r={120} o={0.35} />
    {STARS.map(([rad, a], i) => {
      const th = a + t * 0.08;
      return <circle key={i} cx={Math.cos(th) * rad} cy={Math.sin(th) * rad * 0.55} r={i % 37 ? 2.4 : 4}
        fill={i % 53 ? C.platinum : C.gold} opacity={Math.max(0.15, 1 - rad / 470) * ease(p * 2 - rad / 470)} />;
    })}
  </g>
);

export const Spacetime: React.FC<SceneProps> = ({ t, p }) => {
  const mx = Math.sin(t * 0.4) * 40;
  const depth = 260 * ease(p * 1.2);
  const P = (x: number, y: number) => {
    const d2 = (x - mx) ** 2 + y ** 2;
    const well = depth * 50000 / (d2 + 50000);
    const persp = 1 + y / 1400; // nearer rows sit wider, for depth
    return `${x * persp},${y * 0.45 + well}`;
  };
  const grid: string[] = [];
  for (let k = -420; k <= 420; k += 60) {
    grid.push(Array.from({ length: 29 }, (_, i) => P(-420 + i * 30, k)).join(" "));
    grid.push(Array.from({ length: 29 }, (_, i) => P(k, -420 + i * 30)).join(" "));
  }
  return (
    <g opacity={ease(p * 1.3)} transform="translate(0,-60)">
      {grid.map((g, i) => <polyline key={i} points={g} {...line(0.38, 1.4)} />)}
      <g transform={`translate(${mx},${depth * 0.55})`}><Bloom r={80} o={0.5} /></g>
      <circle cx={mx + 260 * Math.cos(t * 0.8)} cy={depth * 0.55 + 70 * Math.sin(t * 0.8)} r={8} fill={C.gold} />
    </g>
  );
};

const SEEDS = pts(220, "seed", (i, r) => [r("a") * Math.PI * 2, 0.4 + r("s") * 0.6]);
export const Genesis: React.FC<SceneProps> = ({ t, p }) => (
  <g opacity={ease(p * 2)}>
    <Bloom r={130 + 20 * Math.sin(t * 1.5)} o={0.45} />
    {SEEDS.map(([a, s], i) => {
      const r = ((t * 70 * s + i * 13) % 460);
      return <circle key={i} cx={Math.cos(a) * r} cy={Math.sin(a) * r} r={2 + s * 2.5} fill={i % 31 ? C.platinum : C.gold} opacity={1 - r / 460} />;
    })}
  </g>
);
