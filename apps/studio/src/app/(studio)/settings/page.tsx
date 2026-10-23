import Link from "next/link";
import { getSettings } from "@/lib/data";
import { money } from "@/lib/data/settings.build";
import { STEP_LABELS } from "@/lib/steps";
import type { StepName } from "@mmos/contracts";
import { InviteForm } from "./InviteForm";
import { RevokeInvite } from "./RevokeInvite";
import styles from "./settings.module.css";

export const metadata = { title: "Settings · multi-media os" };

export default async function SettingsPage() {
  const data = await getSettings();
  if (!data) return null;

  const { workspace, members, invites, channels, spend } = data;
  const waiting = invites.filter((invite) => !invite.accepted);
  const disconnected = channels.filter((channel) => !channel.connected);

  return (
    <>
      <header style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 760 }}>
        <span className="eyebrow">Your account</span>
        <h1 className="display">Settings</h1>
        <p className="lead">
          The workspace everything sits in, who else is in it, what it is connected to, and what the pipeline has cost
          so far.
        </p>
      </header>

      <section aria-labelledby="workspace">
        <div className="section-head">
          <h2 id="workspace" className="heading">Workspace</h2>
          <span className="quiet">{workspace.name}</span>
        </div>
        <div className={styles.counts} style={{ paddingTop: 24 }}>
          <span className={styles.count}>
            <span className="label">Brands</span>
            <span className={styles.countFigure}>{String(workspace.brands).padStart(2, "0")}</span>
          </span>
          <span className={styles.count}>
            <span className="label">Shows</span>
            <span className={styles.countFigure}>{String(workspace.shows).padStart(2, "0")}</span>
          </span>
          <p className="quiet" style={{ margin: 0, maxWidth: 420 }}>
            Brands and shows are added on <Link className="link-gold" href="/shows">Brands and shows</Link>. Renaming the
            workspace itself is not built yet.
          </p>
        </div>
      </section>

      <section aria-labelledby="people" style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        <div>
          <div className="section-head">
            <h2 id="people" className="heading">People</h2>
            <span className="quiet">{members.length === 1 ? "1 member" : `${members.length} members`}</span>
          </div>
          {members.length === 0 ? (
            <p className="quiet" style={{ paddingTop: 16, margin: 0 }}>
              Nobody is listed as a member of this workspace, which should not happen while you are signed into it.
            </p>
          ) : null}
          {members.map((member) => (
            <div key={member.key} className="row">
              <div className="row__body">
                <span className="row__title" style={{ fontSize: 16 }}>{member.who}</span>
                <span className="quiet">{member.you ? "This is you" : "Email addresses are not readable from here yet"}</span>
              </div>
              <span className={`chip chip--on ${styles.roleChip}`}>{member.role}</span>
            </div>
          ))}
        </div>

        <div>
          <div className="section-head">
            <h3 className="heading" style={{ fontSize: 22 }}>Invites</h3>
            <span className="quiet">
              {waiting.length === 0 ? "None waiting" : waiting.length === 1 ? "1 waiting" : `${waiting.length} waiting`}
            </span>
          </div>
          {invites.length === 0 ? (
            <p className="quiet" style={{ paddingTop: 16, margin: 0 }}>
              Nobody has been invited yet.
            </p>
          ) : null}
          {invites.map((invite) => (
            <div key={invite.id} className="row">
              <div className="row__body">
                <span className="row__title" style={{ fontSize: 16 }}>{invite.email}</span>
                <span className="quiet">
                  {invite.accepted ? `Accepted ${invite.on}` : `Invited ${invite.on}, not accepted yet`}
                </span>
              </div>
              <span className={`chip ${invite.accepted ? "chip--on" : ""} ${styles.roleChip}`}>{invite.role}</span>
              {invite.accepted ? null : <RevokeInvite id={invite.id} email={invite.email} />}
            </div>
          ))}
        </div>

        <InviteForm />
      </section>

      <section aria-labelledby="channels">
        <div className="section-head">
          <h2 id="channels" className="heading">Connected channels</h2>
          <span className="quiet">
            {disconnected.length === 0
              ? `${channels.length === 1 ? "1 channel" : `${channels.length} channels`}, all connected`
              : `${disconnected.length} of ${channels.length} not connected`}
          </span>
        </div>
        {channels.length === 0 ? (
          <p className="quiet" style={{ paddingTop: 16, margin: 0 }}>
            No channels yet. Add one on <Link className="link-gold" href="/shows?add=channel">Brands and shows</Link>.
          </p>
        ) : null}
        {channels.map((channel) => (
          <div key={channel.id} className="row">
            <span aria-hidden="true" className={`${styles.dot} ${channel.connected ? styles.dotOn : styles.dotOff}`} />
            <div className="row__body">
              <span className="row__title" style={{ fontSize: 16 }}>{channel.label}</span>
              <span className="quiet">
                {channel.shows.length > 0 ? `Carried by ${channel.shows.join(", ")}` : "No show posts to it"}
              </span>
            </div>
            <span className={channel.connected ? "chip chip--on" : "chip"}>
              {channel.connected ? "Connected" : "Not connected"}
            </span>
          </div>
        ))}
        {disconnected.length > 0 ? (
          <p className="quiet" style={{ marginTop: 24, maxWidth: 560 }}>
            A channel that is not connected cannot be posted to. Nothing will be published to it, and the Studio will
            say so rather than failing quietly. Reconnecting an account is not built yet.
          </p>
        ) : null}
      </section>

      <section aria-labelledby="spend">
        <div className="section-head">
          <h2 id="spend" className="heading">Spend</h2>
          <span className="quiet">{spend.monthLabel}</span>
        </div>

        <div className={styles.spend} style={{ paddingTop: 28 }}>
          <span className={styles.count}>
            <span className="label">This month</span>
            <span className={styles.spendFigure}>{money(spend.thisMonthPence)}</span>
            <span className="quiet">
              across {spend.jobs === 1 ? "1 job" : `${spend.jobs} jobs`}
            </span>
          </span>
          <span className={styles.count}>
            <span className="label">{spend.lastMonthLabel}</span>
            <span className={styles.spendSecond}>{money(spend.lastMonthPence)}</span>
          </span>
        </div>

        <div style={{ paddingTop: 36, display: "flex", flexDirection: "column", gap: 16 }}>
          <span className="label">By step, this month</span>
          {spend.byStep.length === 0 ? (
            <p className="quiet" style={{ margin: 0 }}>No jobs have run this month, so there is nothing to break down.</p>
          ) : (
            <dl className={styles.steps}>
              {spend.byStep.map((step) => (
                <div key={step.step} style={{ display: "contents" }}>
                  <dt>
                    {STEP_LABELS[step.step as StepName] ?? step.step}
                    <span className="quiet"> · {step.jobs === 1 ? "1 job" : `${step.jobs} jobs`}</span>
                  </dt>
                  <dd>{money(step.pence)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <p className="lead" style={{ paddingTop: 28 }}>
          Nothing caps this yet. Every job records what it cost, and this is the sum of those records, but no limit
          stops a job from running when the total gets high. Watch the figure, and stop the worker if it climbs
          faster than you expect.
        </p>
      </section>
    </>
  );
}
