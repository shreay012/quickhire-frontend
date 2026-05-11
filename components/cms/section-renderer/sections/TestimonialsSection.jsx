/**
 * TestimonialsSection — Phase E (2026-05-10)
 *
 * Renders a grid/carousel of testimonial blocks.
 *
 * Expected blocks:
 *   { type: 'testimonial', content: {
 *       quote:    i18n,
 *       author:   i18n,
 *       role:     i18n,        // job title or company
 *       avatar:   string,      // URL
 *       rating:   number 1..5  // optional star count
 *   }}
 *
 * Section config (optional):
 *   { layout: 'grid' | 'carousel', columns: 1|2|3, title: i18n, subtitle: i18n }
 */

'use client';

import Image from 'next/image';
import { findBlocks, findBlock, pickI18n } from '../blocks.js';

export default function TestimonialsSection({ section, locale = 'en' }) {
  const titleBlock = findBlock(section, 'section_title');
  const items = findBlocks(section, 'testimonial');
  const layout = section?.config?.layout || 'grid';
  const columns = Math.min(Math.max(Number(section?.config?.columns) || 3, 1), 3);

  const title = pickI18n(titleBlock?.content?.title, locale);
  const subtitle = pickI18n(titleBlock?.content?.subtitle, locale);

  if (!items.length) return null;

  const colCls = { 1: 'md:grid-cols-1', 2: 'md:grid-cols-2', 3: 'md:grid-cols-3' }[columns];

  return (
    <section className="w-full py-16 px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        {(title || subtitle) && (
          <div className="text-center mb-10">
            {title ? <h2 className="text-3xl md:text-4xl font-open-sauce-bold text-[#26472B] mb-3">{title}</h2> : null}
            {subtitle ? <p className="text-base text-[#636363] max-w-2xl mx-auto">{subtitle}</p> : null}
          </div>
        )}
        <div className={`grid grid-cols-1 ${colCls} gap-6 ${layout === 'carousel' ? 'overflow-x-auto snap-x snap-mandatory pb-4' : ''}`}>
          {items.map((b, i) => (
            <article
              key={b.id || i}
              className="rounded-2xl bg-[#F7FBF6] ring-1 ring-[#E5F1E2] p-6 snap-start min-w-[280px]"
            >
              {/* Star rating — optional */}
              {b.content?.rating ? (
                <div className="flex gap-0.5 mb-3" aria-label={`${b.content.rating} out of 5 stars`}>
                  {Array.from({ length: 5 }).map((_, s) => (
                    <svg key={s} width={14} height={14} viewBox="0 0 24 24" fill={s < b.content.rating ? '#F59E0B' : '#E5E5E5'}>
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  ))}
                </div>
              ) : null}
              <blockquote className="text-[#26472B] leading-relaxed mb-4 text-sm md:text-base">
                &ldquo;{pickI18n(b.content?.quote, locale)}&rdquo;
              </blockquote>
              <div className="flex items-center gap-3">
                {b.content?.avatar ? (
                  <Image
                    src={b.content.avatar}
                    alt={pickI18n(b.content?.author, locale) || 'avatar'}
                    width={40}
                    height={40}
                    className="rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#45A735] to-[#26472B] flex items-center justify-center text-white font-open-sauce-bold text-sm">
                    {(pickI18n(b.content?.author, locale) || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="font-open-sauce-semibold text-[#26472B] text-sm">
                    {pickI18n(b.content?.author, locale)}
                  </div>
                  {pickI18n(b.content?.role, locale) ? (
                    <div className="text-xs text-[#636363]">{pickI18n(b.content.role, locale)}</div>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
