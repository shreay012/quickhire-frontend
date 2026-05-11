/**
 * FaqSection — accordion of question/answer blocks.
 *
 * Expected blocks:
 *   { type: 'faq_item', content: { question: i18n, answer: i18n } }
 */

'use client';

import { useState } from 'react';
import { findBlocks, pickI18n } from '../blocks.js';

export default function FaqSection({ section, locale = 'en' }) {
  const items = findBlocks(section, 'faq_item');
  const [openIdx, setOpenIdx] = useState(0);

  if (!items.length) return null;
  return (
    <section className="w-full max-w-3xl mx-auto px-6 py-12">
      <h2 className="text-2xl md:text-3xl font-open-sauce-bold text-[#0F3B0F] text-center mb-8">
        {pickI18n(section?.config?.heading, locale) || 'Frequently asked questions'}
      </h2>
      <div className="space-y-2">
        {items.map((b, i) => {
          const q = pickI18n(b.content?.question, locale);
          const a = pickI18n(b.content?.answer, locale);
          const open = openIdx === i;
          return (
            <div key={b.id || i} className="bg-white border border-[#E5F1E2] rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenIdx(open ? -1 : i)}
                className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-[#F2F9F1]"
              >
                <span className="font-open-sauce-semibold text-[#26472B]">{q}</span>
                <span className="text-[#45A735] text-xl leading-none">{open ? '−' : '+'}</span>
              </button>
              {open ? (
                <div className="px-5 pb-4 pt-0 text-[#636363] text-sm leading-relaxed">
                  {a}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
