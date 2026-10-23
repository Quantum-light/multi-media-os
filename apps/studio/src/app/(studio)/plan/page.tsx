import Link from "next/link";
import { Note } from "@/components/Note";
import { getPlan } from "@/lib/data";
import type { PlanShowBoard, PlanSlot, PlanWeek } from "@/lib/data";
import { plural } from "@/lib/format";
import { IdeaForm, IdeaLine } from "./IdeaForm";
import styles from "./plan.module.css";

export const metadata = { title: "Plan · multi-media os" };

const SPANS = [2, 4, 6, 8];

type Props = { searchParams: Promise<{ weeks?: string }> };

export default async function PlanPage({ searchParams }: Props) {
  const { weeks } = await searchParams;
  const plan = await getPlan(weeks);

  if (!plan) {
    return <Intro lead="Add a show first. The board is built from each show's posting slots, so it needs a show with a rhythm." />;
  }

  return (
    <>
      <Intro
        lead={
          plan.empty === 0
            ? "Every slot in the weeks ahead has something against it."
            : `${plural(plan.empty, "slot")} in the next ${plural(plan.weeks, "week")} with nothing against ${plan.empty === 1 ? "it" : "them"} yet. Each one is a question only you can answer.`
        }
      />

      <nav aria-label="How far ahead" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: -24 }}>
        {SPANS.map((n) => (
          <Link
            key={n}
            href={`/plan?weeks=${n}`}
            aria-current={n === plan.weeks ? "page" : undefined}
            className={n === plan.weeks ? "chip chip--on" : "chip"}
          >
            {n} weeks
          </Link>
        ))}
      </nav>

      {plan.shows.length === 0 ? <p className="lead">No shows yet, so there are no slots to plan into.</p> : null}

      {plan.shows.map((show) => (
        <ShowSection key={show.slug} show={show} />
      ))}

      <section aria-labelledby="scouts">
        <div className="section-head">
          <h2 id="scouts" className="heading">Scout agents</h2>
          <span className="quiet">Not connected yet</span>
        </div>
        <p className="lead" style={{ paddingTop: 16 }}>
          Scouts will read back through what you have already said and propose ideas here, each naming the
          episode or line it grew from. Until they are built, every idea on this board is one you wrote,
          and nothing on it is invented.
        </p>
      </section>

      <Note>
        Slots come from each show&rsquo;s posting rhythm, and a slot counts as filled when a post is already
        scheduled within half a day of it. Times are shown in each slot&rsquo;s own time zone.
      </Note>
    </>
  );
}

function Intro({ lead }: { lead: string }) {
  return (
    <header style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 760 }}>
      <span className="eyebrow">Plan</span>
      <h1 className="display">The weeks <em>ahead</em></h1>
      <p className="lead">{lead}</p>
    </header>
  );
}

function ShowSection({ show }: { show: PlanShowBoard }) {
  return (
    <section aria-labelledby={`show-${show.slug}`} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div className="section-head" style={{ flexWrap: "wrap", gap: 12 }}>
        <span className={styles.showHead}>
          <span
            aria-hidden="true"
            className={styles.orb}
            style={show.accent ? { background: show.accent } : undefined}
          />
          <h2 id={`show-${show.slug}`} className="heading">{show.name}</h2>
          <span className="quiet">{show.rhythm}</span>
        </span>
        <Link href={`/vision?show=${show.slug}`} className="link-gold">Pillars</Link>
      </div>

      {show.pillars.length === 0 ? (
        <p className="quiet" style={{ margin: 0, maxWidth: 620 }}>
          No pillars written for this show yet, so an idea here would have nothing to serve.{" "}
          <Link href={`/vision?show=${show.slug}&edit=1`} className="link-gold">Write the vision</Link> and the board
          can tie every gap to one.
        </p>
      ) : (
        <ul className={styles.pillars} aria-label={`Pillars of ${show.name}`}>
          {show.pillarCounts.map((p) => (
            <li key={p.pillar} className={p.ideas === 0 ? `${styles.pillar} ${styles.pillarNone}` : styles.pillar}>
              <span>{p.pillar}</span>
              <span className="figure" style={{ fontSize: 12, color: "var(--gold-ink)" }}>
                {p.ideas === 0 ? "nothing yet" : plural(p.ideas, "idea")}
              </span>
            </li>
          ))}
        </ul>
      )}

      {show.slotCount === 0 ? (
        <p className="quiet" style={{ margin: 0 }}>
          No posting slots in these weeks.{" "}
          <Link href={`/shows?editShow=${show.slug}`} className="link-gold">Set this show&rsquo;s rhythm</Link> and its
          slots appear here.
        </p>
      ) : (
        <div className={styles.board}>
          {show.weeks.map((week) => (
            <WeekBlock key={week.start} week={week} show={show} />
          ))}
        </div>
      )}

      {show.loose.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <span className="label">Ideas without a slot</span>
          {show.loose.map((idea) => (
            <IdeaLine key={idea.id} idea={idea} />
          ))}
        </div>
      ) : null}

      {show.pillars.length > 0 ? (
        <IdeaForm showSlug={show.slug} pillars={show.pillars} slotAt={null} openLabel="Write an idea with no slot yet" />
      ) : null}
    </section>
  );
}

function WeekBlock({ week, show }: { week: PlanWeek; show: PlanShowBoard }) {
  return (
    <article className={`${styles.week} glass`}>
      <div className={styles.weekHead}>
        <h3 className={styles.weekName}>
          {week.label}
          {week.thisWeek ? <span className="quiet" style={{ fontSize: 13, fontFamily: "inherit" }}> · this week</span> : null}
        </h3>
        <span className="quiet">
          {week.anchors.length > 0 ? `${week.anchors.join(" · ")} · ` : ""}
          {week.slots.length === 0 ? "No slots left this week" : week.empty === 0 ? "Nothing open" : `${plural(week.empty, "slot")} open`}
        </span>
      </div>

      {week.slots.map((slot) => (
        <SlotRow key={slot.key} slot={slot} show={show} />
      ))}
    </article>
  );
}

function SlotRow({ slot, show }: { slot: PlanSlot; show: PlanShowBoard }) {
  const open = slot.fill === null;
  return (
    <div className={open ? `${styles.slot} ${styles.slotOpen}` : styles.slot}>
      <span className={styles.slotWhen}>
        <span className={styles.slotDay}>{slot.dayLabel}</span>
        <span className="figure" style={{ fontSize: 13, color: "var(--ink-quiet)" }}>{slot.time}</span>
      </span>

      <div className={styles.slotBody}>
        {slot.fill ? (
          <span className={styles.filled}>
            <span className={styles.filledLabel}>{slot.fill.label}</span>
            <span className="quiet">{slot.fill.status.replaceAll("_", " ")}</span>
          </span>
        ) : slot.ideas.length === 0 ? (
          <p className={styles.ask}>What goes out here?</p>
        ) : null}

        {slot.ideas.map((idea) => (
          <IdeaLine key={idea.id} idea={idea} />
        ))}

        {open ? (
          <IdeaForm
            showSlug={show.slug}
            pillars={show.pillars}
            slotAt={slot.at}
            openLabel={slot.ideas.length === 0 ? "Write an idea for this slot" : "Add another"}
          />
        ) : null}
      </div>
    </div>
  );
}
