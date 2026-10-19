"use client";

import styles from "./Form.module.css";

type LineProps = {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  optional?: boolean;
  rows?: number;
};

/** One labelled box of words. Two rows by default, because people write sentences. */
export function Line({ label, value, placeholder, onChange, optional = false, rows = 2 }: LineProps) {
  return (
    <label className={styles.field}>
      <Label text={label} optional={optional} />
      <textarea
        className={styles.textarea}
        rows={rows}
        value={value}
        placeholder={placeholder ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

/** One labelled line, for names and handles rather than sentences. */
export function Word({ label, value, placeholder, onChange, optional = false }: Omit<LineProps, "rows">) {
  return (
    <label className={styles.field}>
      <Label text={label} optional={optional} />
      <input className={styles.input} value={value} placeholder={placeholder ?? ""} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

type ChoiceProps<T extends string> = {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
};

export function Choice<T extends string>({ label, value, options, onChange }: ChoiceProps<T>) {
  return (
    <label className={styles.field}>
      <Label text={label} />
      <select className={styles.select} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

type WordListProps = {
  label: string;
  hint?: string;
  values: string[];
  placeholder: string;
  max: number;
  addLabel: string;
  numbered?: boolean;
  onChange: (values: string[]) => void;
};

/** A short list a person keeps adding to: pillars, style words, things never to do. */
export function WordList({ label, hint, values, placeholder, max, addLabel, numbered = false, onChange }: WordListProps) {
  const rows = values.length === 0 ? [""] : values;
  const set = (index: number, value: string) => onChange(rows.map((row, i) => (i === index ? value : row)));
  return (
    <div className={styles.field}>
      <div className="section-head" style={{ borderBottom: 0, paddingBottom: 0 }}>
        <Label text={label} />
        {hint ? <span className="quiet">{hint}</span> : null}
      </div>
      <div className={styles.rows}>
        {rows.map((row, i) => (
          <div key={i} className={styles.row}>
            {numbered ? <span className={`${styles.count} figure`}>{String(i + 1).padStart(2, "0")}</span> : null}
            <input className={styles.input} value={row} placeholder={placeholder} onChange={(e) => set(i, e.target.value)} />
            {rows.length > 1 ? (
              <button type="button" className={styles.remove} aria-label={`Remove ${label} ${i + 1}`} onClick={() => onChange(rows.filter((_, j) => j !== i))}>
                Remove
              </button>
            ) : null}
          </div>
        ))}
      </div>
      {rows.length < max ? (
        <button type="button" className={styles.add} onClick={() => onChange([...rows, ""])}>{addLabel}</button>
      ) : null}
    </div>
  );
}

/** A colour, shown as itself. The text box stays, so a hex can be pasted in. */
export function Colour({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const valid = /^#[0-9A-Fa-f]{6}$/.test(value);
  return (
    <label className={styles.field}>
      <Label text={label} />
      <span className={styles.row}>
        <input
          type="color"
          className={styles.swatch}
          aria-label={`${label} colour picker`}
          value={valid ? value : "#ffffff"}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
        />
        <input className={styles.input} value={value} placeholder="#C9A24A" onChange={(e) => onChange(e.target.value)} />
      </span>
    </label>
  );
}

export function Problems({ message, problems }: { message: string; problems: string[] }) {
  return (
    <div className={styles.problems} role="alert">
      <p style={{ margin: 0 }}>{message}</p>
      {problems.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          {problems.map((problem) => <li key={problem}>{problem}</li>)}
        </ul>
      ) : null}
    </div>
  );
}

export function Saved({ children }: { children: React.ReactNode }) {
  return <p className={styles.saved} role="status">{children}</p>;
}

export function Actions({ saving, onSave, cancelHref, saveLabel = "Save" }: { saving: boolean; onSave: () => void; cancelHref?: string; saveLabel?: string }) {
  return (
    <div className={styles.actions}>
      <button type="button" className="btn-gold" onClick={onSave} disabled={saving}>{saving ? "Saving…" : saveLabel}</button>
      {cancelHref ? <a className="link-gold" href={cancelHref}>Cancel</a> : null}
    </div>
  );
}

function Label({ text, optional = false }: { text: string; optional?: boolean }) {
  return (
    <span className="label">
      {text}
      {optional ? <span className="quiet" style={{ textTransform: "none", letterSpacing: 0 }}> · optional</span> : null}
    </span>
  );
}
