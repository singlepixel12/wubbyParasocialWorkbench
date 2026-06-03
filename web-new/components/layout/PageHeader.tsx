/**
 * PageHeader Component
 * Lightweight editorial header for the secondary/utility pages — a quiet echo of
 * the VOD Diary Masthead: top hairline + mono kicker, a Fraunces display title,
 * a muted-ink description, closed with a bottom hairline rule.
 * Static by design (no entrance motion) so the tool pages feel instant.
 * The big Masthead stays reserved for the home/diary.
 */

interface PageHeaderProps {
  title: string;
  description: string;
  /** Mono kicker shown above the title. Defaults to the archive imprint line. */
  kicker?: string;
}

export function PageHeader({ title, description, kicker = 'Archive · est. wubby.tv' }: PageHeaderProps) {
  return (
    <header className="border-b border-rule pb-4">
      {/* Top hairline + mono kicker */}
      <div className="border-t border-rule pt-3">
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-ink-muted">
          {kicker}
        </span>
      </div>

      {/* Fraunces display title */}
      <h2 className="font-display mt-3 text-3xl leading-tight tracking-tight text-foreground md:text-4xl">
        {title}
      </h2>

      {/* Muted-ink description */}
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted md:text-base">
        {description}
      </p>
    </header>
  );
}
