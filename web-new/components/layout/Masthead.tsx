'use client';

/**
 * Masthead Component
 * Editorial "archive periodical" header for the VOD Diary home page.
 * Oversized Fraunces wordmark + hairline rules + an issue/count meta line.
 * Distinct from PageHeader (which stays for the other, utilitarian pages).
 */

import { motion, useReducedMotion } from 'framer-motion';

interface MastheadProps {
  /** Section/edition name shown in the meta line (e.g. "VOD Diary") */
  edition: string;
  /** Number of records currently shown — becomes the "No. NN" issue number */
  count: number;
  /** Optional human date-range label for the right side of the meta line */
  dateLabel?: string;
}

export function Masthead({ edition, count, dateLabel }: MastheadProps) {
  const reduce = useReducedMotion();

  const issue = `No. ${count.toString().padStart(2, '0')}`;

  return (
    <header className="masthead-band relative -mx-2 mb-2 px-2 pt-2 pb-5 md:-mx-4 md:px-4 md:pt-4">
      {/* Top hairline + kicker */}
      <div className="flex items-center justify-between border-t border-rule pt-3">
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-ink-muted">
          Archive&nbsp;·&nbsp;est. wubby.tv
        </span>
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-ink-muted">
          {issue}
        </span>
      </div>

      {/* Wordmark */}
      <motion.h1
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="font-display mt-3 text-4xl leading-[0.95] tracking-tight text-foreground sm:text-5xl md:text-6xl"
      >
        The Wubby{' '}
        <span className="italic text-accent-green">Archive</span>
      </motion.h1>

      {/* Bottom meta line + hairline */}
      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule pb-3">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">
          {edition}
          <span className="mx-2 text-rule">/</span>
          AI summaries &amp; smart tagging
        </p>
        {dateLabel && (
          <p className="font-mono text-xs tracking-wide text-ink-muted">{dateLabel}</p>
        )}
      </div>
    </header>
  );
}
