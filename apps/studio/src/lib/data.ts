/**
 * All screen data comes through here: one call per screen.
 * Today these return sample data shaped exactly like the database will;
 * when Supabase is connected only these function bodies change.
 */
import type { Compass } from "@mmos/contracts";

export type ForYouItem = { id: string; title: string; detail: string; href: string; cta: string; primary: boolean; kind: "review" | "ideas" | "setup"; count?: number };
export type StudioJob = { id: string; name: string; show: string; stepLabel: string; stepIndex: number; totalSteps: number };
export type WeekDay = { day: string; items: string };

export type TodayData = {
  dateLabel: string;
  summary: string;
  forYou: ForYouItem[];
  inStudio: StudioJob[];
  week: WeekDay[];
  healthy: boolean;
  isSample: boolean;
};

export async function getToday(): Promise<TodayData> {
  return {
    dateLabel: "Sunday 4 October",
    summary: "One episode is ready for you. Three new ideas arrived overnight. Everything else is running quietly in the background.",
    forYou: [
      { id: "review-ep1", kind: "review", title: "What Is Time, Really?", detail: "Human Time with GG · ready for review · one approval schedules 18 posts", href: "/", cta: "Review", primary: true },
      { id: "ideas", kind: "ideas", count: 3, title: "New ideas from Scout", detail: "Each built on something you have already said", href: "/", cta: "See ideas", primary: false },
      { id: "tech-brand", kind: "setup", title: "Finish setting up your tech brand", detail: "Add your style, then connect where it posts", href: "/", cta: "Continue", primary: false },
    ],
    inStudio: [
      { id: "j1", name: "Journeys with Time · new upload", show: "Podcast · uploaded this morning", stepLabel: "Cutting", stepIndex: 2, totalSteps: 11 },
      { id: "j2", name: "Human Time with GG · Episode 2", show: "Video show · uploaded yesterday", stepLabel: "Composing graphics", stepIndex: 7, totalSteps: 11 },
    ],
    week: [
      { day: "Tue 6", items: "Human Time with GG episode, a short, a reel, a Threads post" },
      { day: "Wed 7", items: "A short, a reel, a Threads post" },
      { day: "Thu 8", items: "A short, a reel, a Threads post" },
      { day: "Fri 9", items: "Journeys with Time episode, once approved" },
      { day: "Sat 10", items: "A short and a reel" },
      { day: "Sun 11", items: "A short and a reel" },
      { day: "Mon 12", items: "A short and a reel" },
    ],
    healthy: true,
    isSample: true,
  };
}

export type VisionData = { showName: string; compass: Compass; pillarShares: Record<string, number>; isSample: boolean };

export async function getVision(): Promise<VisionData> {
  const kpi = (name: string, current: number, target: number, unit: string, evidenceSource: string) => ({ name, current, target, unit, evidenceSource });
  return {
    showName: "Human Time with GG",
    isSample: true,
    pillarShares: { "Personal growth and time": 35, "Quantum science and spirituality": 45, "Business and entrepreneurship": 10, "Relationships and family": 10 },
    compass: {
      whatItIs: "The human, behind-the-scenes side of Quantum Light Science, on YouTube.",
      mission: "Help everyday people understand time, and use it to live fuller lives.",
      pillars: ["Personal growth and time", "Quantum science and spirituality", "Business and entrepreneurship", "Relationships and family"],
      howYouSeeIt: "Everyday science, but regal enough. Human first.",
      vision: "The show people turn to when they want time explained, and a doorway into the book, the podcast and the documentary.",
      mainGoal: {
        statement: "Become a trusted twice-weekly show for curious, time-hungry people",
        by: "2027-10-01",
        objectives: [
          { title: "Show up consistently", kpis: [kpi("Episodes a month", 1, 8, "", "calendar.published_episodes"), kpi("Shorts a week", 7, 7, "", "calendar.published_shorts")] },
          { title: "Earn trust", kpis: [kpi("Returning viewers", 34, 45, "%", "youtube_analytics.returning_viewers"), kpi("Comments asking to go deeper", 12, 40, "", "comments.librarian_tag.go_deeper")] },
          { title: "Reach the people you are for", kpis: [kpi("Curious-seeker match", 72, 80, "%", "audience_fit.persona.curious_seeker"), kpi("Founder match", 23, 40, "%", "audience_fit.persona.founder")] },
        ],
      },
    },
  };
}
