/**
 * StatisticsSection — Phase E (2026-05-10)
 *
 * Big-number KPI strip — for "10,000+ professionals" / "98% satisfaction"
 * trust-builder rows under the hero.
 *
 * Expected blocks:
 *   { type: 'stat', content: { value: string, label: i18n, suffix?: string, icon?: string } }
 *
 * Section config (optional):
 *   { columns: 3|4|5, title: i18n, theme: 'light' | 'dark' }
 */

'use client';

import { findBlocks, findBlock, pickI18n } from '../blocks.js';

export default function StatisticsSection({ section, locale = 'en' }) {
  const titleBlock = findBlock(section, 'section_title');
  const stats = findBlocks(section, 'stat');
  const columns = Math.min(Math.max(Number(section?.config?.columns) || stats.length || 4, 2), 5);
  const theme = section?.config?.theme || 'light';
  const title = pickI18n(titleBlock?.content?.title, locale);

  if (!stats.length) return null;

  const isDark = theme === 'dark';
  const bgCls = isDark ? 'bg-[#0F3B0F]' : 'bg-white';
  const labelCls = isDark ? 'text-[#A8D5A8]' : 'text-[#636363]';
  const valueCls = isDark ? 'text-white' : 'text-[#26472B]';
  const colCls = { 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-4', 5: 'md:grid-cols-5' }[columns];

  return (
    <section className={`w-full py-14 px-6 ${bgCls}`}>
      <div className="max-w-6xl mx-auto">
        {title ? (
          <h2 className={`text-center text-2xl md:text-3xl font-open-sauce-bold ${valueCls} mb-10`}>
            {title}
          </h2>
        ) : null}
        <div className={`grid grid-cols-2 ${colCls} gap-6 text-center`}>
          {stats.map((b, i) => (
            <div key={b.id || i}>
              {b.content?.icon ? <div className="text-3xl mb-2" aria-hidden>{b.content.icon}</div> : null}
              <div className={`text-3xl md:text-5xl font-open-sauce-bold tabular-nums ${valueCls}`}>
                {b.content?.value || '—'}
                {b.content?.suffix ? <span className="text-2xl md:text-3xl ml-0.5">{b.content.suffix}</span> : null}
              </div>
              <div className={`mt-2 text-xs md:text-sm font-open-sauce ${labelCls}`}>
                {pickI18n(b.content?.label, locale)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
