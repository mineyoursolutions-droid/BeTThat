import { Link } from 'react-router-dom';

export default function SectionHeading({ eyebrow, title, description, actionLabel, actionTo }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        {eyebrow ? (
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
        ) : null}
        <h2 className="mt-2.5 text-[26px] font-extrabold leading-tight tracking-[-0.03em] sm:text-[34px]">{title}</h2>
        {description ? <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">{description}</p> : null}
      </div>
      {actionLabel && actionTo ? (
        <Link
          to={actionTo}
          className="shrink-0 rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary/40 hover:text-primary"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}