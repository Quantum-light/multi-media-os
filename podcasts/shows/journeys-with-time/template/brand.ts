// Quantum Light Science / Journeys with Time tokens. Source of truth: the QLS Brand Guide doc.
import { loadFont as loadCinzel } from "@remotion/google-fonts/Cinzel";
import { loadFont as loadCrimson } from "@remotion/google-fonts/CrimsonPro";

export const cinzel = loadCinzel("normal", { weights: ["400", "500"], subsets: ["latin"] }).fontFamily;
export const crimson = loadCrimson("normal", { weights: ["400", "500"], subsets: ["latin"] }).fontFamily;
loadCrimson("italic", { weights: ["400"], subsets: ["latin"] });

export const C = {
  night: "#150A26",
  velvet: "#22103C",
  amethyst: "#40205E",
  orchid: "#A47BE6",
  platinum: "#ECE7F5",
  bright: "#F4F1F8",
  soft: "#C8C1D8",
  gold: "#D9A84E",
  dawn: "#E9C27A",
};

export const FPS = 30;
export const W = 1080;
export const H = 1920;
export const INTRO = 45; // 1.5 s of stillness before the voice
export const OUTRO = 90; // 3 s end frame

// Frame zones (see the brand guide's Clip system table)
// Top 220 px sits under TikTok / Instagram top bars and tabs; keep everything below it.
export const ZONE = { label: 236, visualTop: 340, visualCy: 760, captionsTop: 1180, captionsBottom: 1500, thread: 1490, left: 88, right: 144 };

export type Word = { text: string; start: number; end: number };
export type ClipProps = {
  title: string; n: number; total: number; audio: string; episode?: string;
  durationMs: number; words: Word[]; loop: string | null;
  shots?: { atMs: number; scene: string; label?: string; art?: string }[]; // from the visual director
};
