/**
 * All screen data comes through here: one call per screen.
 * Each function reads as the signed-in person, so row-level security
 * decides what they can see. Empty results are real, never sample data.
 */
export { getShell, type Shell } from "./data/shell";
export { getToday, type TodayData } from "./data/today";
export { getCalendar, type CalendarData } from "./data/calendar";
export { getShows, type ShowsData } from "./data/shows";
export { getVision, type VisionData, type VisionShow } from "./data/vision";
