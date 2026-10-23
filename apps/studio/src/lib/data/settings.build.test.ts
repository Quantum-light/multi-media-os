import { describe, expect, it } from "vitest";
import { buildSettings, checkInvite, money, monthKey, startOfLastMonth, startOfMonth, type SettingsRows } from "./settings.build";

const ME = { userId: "u1", email: "grace@quantumlightscience.org" };
const ZONE = "Asia/Makassar"; // UTC+8, so a month turns eight hours before UTC does
const NOW = new Date("2026-10-23T02:00:00Z");

const base: SettingsRows = {
  workspace: { name: "Quantum Light Science", brands: 2, shows: 3 },
  members: [],
  invites: [],
  channels: [],
  links: [],
  shows: [],
  jobs: [],
};

describe("buildSettings", () => {
  it("is honest when the workspace is just one person with nothing connected", () => {
    const s = buildSettings({ ...base, members: [{ user_id: "u1", role: "owner" }] }, NOW, ZONE, ME);
    expect(s.workspace).toEqual({ name: "Quantum Light Science", brands: 2, shows: 3 });
    expect(s.members).toEqual([{ key: "u1", who: ME.email, you: true, role: "Owner" }]);
    expect(s.invites).toEqual([]);
    expect(s.channels).toEqual([]);
    expect(s.spend.thisMonthPence).toBe(0);
    expect(s.spend.byStep).toEqual([]);
    expect(s.spend.monthLabel).toBe("October 2026");
    expect(s.spend.lastMonthLabel).toBe("September 2026");
  });

  it("names the signed-in person and leaves the others as members", () => {
    const s = buildSettings(
      { ...base, members: [{ user_id: "u1", role: "owner" }, { user_id: "abcdef1234", role: "approver" }] },
      NOW,
      ZONE,
      ME,
    );
    expect(s.members[1]).toEqual({ key: "abcdef1234", who: "Member abcdef12", you: false, role: "Approver" });
  });

  it("separates invites that are waiting from ones already accepted", () => {
    const s = buildSettings(
      {
        ...base,
        invites: [
          { id: "i1", email: "editor@example.com", role: "editor", accepted_at: null, created_at: "2026-10-20T00:00:00Z" },
          { id: "i2", email: "seen@example.com", role: "viewer", accepted_at: "2026-10-21T00:00:00Z", created_at: "2026-10-01T00:00:00Z" },
        ],
      },
      NOW,
      ZONE,
      ME,
    );
    expect(s.invites[0]).toEqual({ id: "i1", email: "editor@example.com", role: "Editor", accepted: false, on: "20 October 2026" });
    expect(s.invites[1]!.accepted).toBe(true);
    expect(s.invites[1]!.on).toBe("21 October 2026");
  });

  it("says which shows carry a channel, and which channels nothing carries", () => {
    const s = buildSettings(
      {
        ...base,
        shows: [{ id: "s1", name: "Human Time with GG" }, { id: "s2", name: "Tech Prophecy Time" }],
        channels: [
          { id: "c1", platform: "youtube", handle: "@humantimewithgg", status: "connected" },
          { id: "c2", platform: "tiktok", handle: "@attachai", status: "disconnected" },
        ],
        links: [{ show_id: "s1", channel_id: "c1" }, { show_id: "s2", channel_id: "c1" }],
      },
      NOW,
      ZONE,
      ME,
    );
    expect(s.channels[0]).toEqual({
      id: "c1",
      label: "YouTube @humantimewithgg",
      handle: "@humantimewithgg",
      connected: true,
      shows: ["Human Time with GG", "Tech Prophecy Time"],
    });
    expect(s.channels[1]!.connected).toBe(false);
    expect(s.channels[1]!.shows).toEqual([]);
  });

  it("sums this month, last month, and this month by step, dearest first", () => {
    const s = buildSettings(
      {
        ...base,
        jobs: [
          { step: "transcribe", cost_pence: 120, created_at: "2026-10-02T03:00:00Z" },
          { step: "transcribe", cost_pence: 80, created_at: "2026-10-09T03:00:00Z" },
          { step: "write", cost_pence: 450, created_at: "2026-10-10T03:00:00Z" },
          { step: "cut", cost_pence: 0, created_at: "2026-10-11T03:00:00Z" },
          { step: "write", cost_pence: 999, created_at: "2026-09-30T03:00:00Z" },
        ],
      },
      NOW,
      ZONE,
      ME,
    );
    expect(s.spend.thisMonthPence).toBe(650);
    expect(s.spend.lastMonthPence).toBe(999);
    expect(s.spend.jobs).toBe(4);
    expect(s.spend.byStep).toEqual([
      { step: "write", pence: 450, jobs: 1 },
      { step: "transcribe", pence: 200, jobs: 2 },
      { step: "cut", pence: 0, jobs: 1 },
    ]);
  });

  it("counts a job by the month the workspace was in, not the month in UTC", () => {
    // 30 September 17:00 UTC is already 1 October in Makassar.
    const rows = { ...base, jobs: [{ step: "cut", cost_pence: 300, created_at: "2026-09-30T17:00:00Z" }] };
    expect(buildSettings(rows, NOW, ZONE, ME).spend.thisMonthPence).toBe(300);
    expect(buildSettings(rows, NOW, "UTC", ME).spend.lastMonthPence).toBe(300);
  });
});

describe("month boundaries", () => {
  it("starts the month at local midnight, not UTC midnight", () => {
    expect(startOfMonth(NOW, ZONE).toISOString()).toBe("2026-09-30T16:00:00.000Z");
    expect(startOfMonth(NOW, "UTC").toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });

  it("steps back a whole month for the earliest jobs it reads", () => {
    expect(startOfLastMonth(NOW, ZONE).toISOString()).toBe("2026-08-31T16:00:00.000Z");
    expect(monthKey(startOfLastMonth(NOW, "UTC"), "UTC")).toBe("2026-09");
  });

  it("handles January, where last month is in the year before", () => {
    const january = new Date("2027-01-15T12:00:00Z");
    expect(monthKey(startOfLastMonth(january, "UTC"), "UTC")).toBe("2026-12");
  });
});

describe("money", () => {
  it("reads as pounds, and says nothing when there is nothing", () => {
    expect(money(0)).toBe("nothing");
    expect(money(5)).toBe("£0.05");
    expect(money(1234)).toBe("£12.34");
  });
});

describe("checkInvite", () => {
  it("accepts an address and a role", () => {
    expect(checkInvite("Someone@Example.com", "editor", [])).toEqual([]);
  });

  it("refuses an empty address, a malformed one, and a repeat", () => {
    expect(checkInvite("  ", "editor", [])).toEqual(["The email address is still empty."]);
    expect(checkInvite("not-an-address", "editor", [])).toEqual(['"not-an-address" does not look like an email address.']);
    expect(checkInvite("seen@example.com", "editor", ["SEEN@example.com"])).toEqual(["seen@example.com has already been invited."]);
  });

  it("refuses a role that is not one of the four", () => {
    expect(checkInvite("someone@example.com", "admin", [])).toEqual([
      '"admin" is not one of Owner, Editor, Approver and Viewer.',
    ]);
  });
});
