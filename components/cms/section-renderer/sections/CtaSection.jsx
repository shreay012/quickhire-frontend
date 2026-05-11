/**
 * CtaSection — Phase E (2026-05-11)
 *
 * Big call-to-action band — the "Ready to hire?" strip near the bottom
 * of conversion-oriented pages.
 *
 * Expected blocks:
 *   { type: 'section_title', content: { title: i18n, subtitle: i18n } }
 *   { type: 'cta',           content: { label: i18n, target: '/...' } }
 *   { type: 'cta',           content: { label: i18n, target: '/...', variant: 'secondary' } }   // optional second
 *
 * Section config (optional):
 *   { theme: 'green' | 'dark' | 'light', alignment: 'left' | 'center' }
 */

'use client';

import Link from 'next/link';
import { findBlock, findBlocks, pickI18n } from '../blocks.js';

const THEMES = {
  green: { bg: 'bg-gradient-to-br from-[#45A735] to-[#26472B]', title: 'text-white', subtitle: 'text-[#D6EBCF]', primaryBtn: 'bg-white text-[#0F3B0F] hover:bg-[#F2F9F1]', secondaryBtn: 'border border-white/40 text-white hover:bg-white/10' },
  dark:  { bg: 'bg-[#0F3B0F]',                                   title: 'text-white', subtitle: 'text-[#A8D5A8]', primaryBtn: 'bg-[#78EB54] text-[#0F3B0F] hover:bg-[#A8FF85]', secondaryBtn: 'border border-white/40 text-white hover:bg-white/10' },
  light: { bg: 'bg-[#F7FBF6]',                                   title: 'text-[#26472B]', subtitle: 'text-[#636363]', primaryBtn: 'bg-[#45A735] text-white hover:bg-[#0F3B0F]', secondaryBtn: 'border border-[#D6EBCF] text-[#26472B] hover:bg-white' },
};

export default function CtaSection({ section, locale = 'en' }) {
  const titleBlock = findBlock(section, 'section_title');
  const ctas = findBlocks(section, 'cta');
  const theme = THEMES[section?.config?.theme] || THEMES.green;
  const alignment = section?.config?.alignment === 'left' ? 'text-left items-start' : 'text-center items-center';

  const title = pickI18n(titleBlock?.content?.title, locale);
  const subtitle = pickI18n(titleBlock?.content?.subtitle, locale);

  if (!title && !ctas.length) return null;

  return (
    <section className={`w-full py-16 px-6 ${theme.bg}`}>
      <div className={`max-w-4xl mx-auto flex flex-col gap-6 ${alignment}`}>
        {title ? (
          <h2 className={`text-3xl md:text-5xl font-open-sauce-bold ${theme.title}`}>{title}</h2>
        ) : null}
        {subtitle ? (
          <p className={`text-base md:text-lg ${theme.subtitle} max-w-2xl`}>{subtitle}</p>
        ) : null}
        {ctas.length ? (
          <div className="flex flex-wrap gap-3 mt-2">
            {ctas.map((b, i) => {
              const isSecondary = i > 0 || b.content?.variant === 'secondary';
              const cls = isSecondary ? theme.secondaryBtn : theme.primaryBtn;
              return (
                <Link
                  key={b.id || i}
                  href={b.content?.target || '#'}
                  className={`inline-block px-7 py-3 rounded-full font-open-sauce-semibold text-sm md:text-base transition-colors ${cls}`}
                >
                  {pickI18n(b.content?.label, locale)}
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}
