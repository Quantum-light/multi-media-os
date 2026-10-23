// Shared drawing kit for scenes. Every scene draws inside a 1000×1000 box centred on 0,0.
import { random } from "remotion";
import { C } from "../brand";

export type SceneProps = { t: number; p: number; label?: string }; // t = seconds in scene, p = 0..1 entrance

export const dotted = (gap = 16, width = 4) => ({
  fill: "none", stroke: C.platinum, strokeLinecap: "round" as const, strokeWidth: width, strokeDasharray: `0.1 ${gap}`,
});
export const line = (opacity = 0.6, width = 1.6) => ({ fill: "none", stroke: C.platinum, strokeWidth: width, opacity });
// Draw a solid path on: pass pathLength={1} on the element.
export const drawOn = (p: number) => ({ strokeDasharray: 1, strokeDashoffset: 1 - Math.min(1, Math.max(0, p)) });
export const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

export const pts = (n: number, seed: string, fn: (i: number, r: (k: string) => number) => [number, number]) =>
  Array.from({ length: n }, (_, i) => fn(i, (k) => random(`${seed}-${k}-${i}`)));
