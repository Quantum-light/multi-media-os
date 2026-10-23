// The scene library. The visual director (lib/direct.mjs) chooses from these by meaning.
// Add a scene: write the component, register it here with a one-line meaning.
import type React from "react";
import type { SceneProps } from "./kit";
import { Cone, TimeRings, Hourglass } from "./time";
import { Sphere, Orbits, Galaxy, Spacetime, Genesis } from "./cosmos";
import { Figure, Pulse, Waves, Lattice, Network, Horizon, Keyword } from "./life";

export const SCENES: Record<string, React.FC<SceneProps>> = {
  sphere: Sphere, cone: Cone, rings: TimeRings, hourglass: Hourglass, orbits: Orbits, galaxy: Galaxy,
  spacetime: Spacetime, genesis: Genesis, figure: Figure, pulse: Pulse, waves: Waves, lattice: Lattice,
  network: Network, horizon: Horizon, keyword: Keyword,
};
