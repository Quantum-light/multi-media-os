import Link from "next/link";
import type { CalendarLayers, LayerOption } from "@/lib/data";
import styles from "./calendar.module.css";

type Props = { layers: CalendarLayers; themes: { name: string; count: number }[]; hidden: number };

/**
 * What the calendar is showing: by show, by platform, with the themes behind it.
 * Every choice is a link, so the address can be shared and the back button works.
 */
export function Layers({ layers, themes, hidden }: Props) {
  return (
    <section className={styles.layers} aria-label="Layers">
      <Group label="Shows" options={layers.shows} empty="No shows yet." />
      <Group label="Platforms" options={layers.platforms} empty="Nothing scheduled this month." />

      <div className={styles.layerRow}>
        <span className="label">Themes</span>
        {themes.length === 0 ? (
          <span className="quiet">Themes appear here as the system reads each recording.</span>
        ) : (
          <span className={styles.themes}>
            {themes.map((t) => (
              <span key={t.name} className={styles.theme}>
                {t.name} <span className="figure">{t.count}</span>
              </span>
            ))}
          </span>
        )}
      </div>

      <p className="quiet" style={{ margin: 0 }}>
        {layers.on ? (
          <>
            {hidden > 0 ? `${hidden} ${hidden === 1 ? "post" : "posts"} hidden by these layers. ` : "These layers are on. "}
            <Link className="link-gold" href={layers.clearHref}>Show everything</Link>
          </>
        ) : (
          "Nothing chosen, so everything shows. Pick a show or a platform to narrow it."
        )}
      </p>
    </section>
  );
}

function Group({ label, options, empty }: { label: string; options: LayerOption[]; empty: string }) {
  return (
    <div className={styles.layerRow}>
      <span className="label">{label}</span>
      {options.length === 0 ? (
        <span className="quiet">{empty}</span>
      ) : (
        <span className={styles.chips}>
          {options.map((o) => (
            <Link key={o.value} href={o.href} className={o.on ? "chip chip--on" : "chip"} aria-label={`${o.label}${o.on ? ", showing. Select again to show everything" : ", select to show only this"}`}>
              <span aria-hidden="true" className={styles.dot} style={o.accent ? { background: o.accent } : undefined} />
              {o.label} <span className="figure">{o.count}</span>
            </Link>
          ))}
        </span>
      )}
    </div>
  );
}
