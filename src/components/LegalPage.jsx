// LegalPage — shared shell for the public legal pages (Privacy Policy,
// Account Deletion). Keeps the street-corner look (Anton display type,
// graffiti tag accent) while staying readable: narrow column, clear
// section headings, generous line height.
import { Link } from 'react-router-dom';

export function LegalSection({ title, children }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-xl uppercase tracking-wide text-foreground sm:text-2xl">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-foreground/85">
        {children}
      </div>
    </section>
  );
}

export function LegalList({ items }) {
  return (
    <ul className="list-disc space-y-2 pl-5 marker:text-primary">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export default function LegalPage({ eyebrow, title, intro, updated, children }) {
  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <p className="font-tag text-lg text-primary">{eyebrow}</p>
      <h1 className="mt-2 font-display text-4xl uppercase leading-[1.05] tracking-wide text-foreground sm:text-5xl">
        {title}
      </h1>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
        {intro}
      </p>
      <p className="mt-3 text-sm text-muted-foreground/80">Last updated: {updated}</p>

      <div className="mt-4 rounded-2xl border border-border bg-card p-5 sm:p-8">{children}</div>

      <div className="mt-8 flex flex-wrap gap-4 text-sm">
        <Link to="/privacy" className="font-semibold text-primary underline-offset-4 hover:underline">
          Privacy Policy
        </Link>
        <Link to="/account-deletion" className="font-semibold text-primary underline-offset-4 hover:underline">
          Delete Account
        </Link>
        <Link to="/" className="font-semibold text-muted-foreground underline-offset-4 hover:underline">
          Back to BetThat
        </Link>
      </div>
    </div>
  );
}
