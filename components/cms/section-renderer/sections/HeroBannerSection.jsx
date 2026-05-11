/**
 * HeroBannerSection — renders a hero with headline, subhead, and CTA.
 *
 * Expected blocks:
 *   { type: 'headline', content: { headline: i18n } }
 *   { type: 'subhead',  content: { sub:      i18n } }
 *   { type: 'cta',      content: { label: i18n, target: '/...' } }
 *   { type: 'video',    content: { src, thumbnail, duration } }   // optional
 *
 * Section config (optional):
 *   { layout: 'centered' | 'split', height: 'tall' | 'short' }
 */

'use client';

import Link from 'next/link';
import { findBlock, pickI18n } from '../blocks.js';

export default function HeroBannerSection({ section, locale = 'en' }) {
  const headlineBlock = findBlock(section, 'headline');
  const subBlock      = findBlock(section, 'subhead');
  const ctaBlock      = findBlock(section, 'cta');
  const videoBlock    = findBlock(section, 'video');

  const headline = pickI18n(headlineBlock?.content?.headline, locale);
  const sub      = pickI18n(subBlock?.content?.sub, locale);
  const ctaLabel = pickI18n(ctaBlock?.content?.label, locale);
  const ctaTarget = ctaBlock?.content?.target || '#';

  const tall = section?.config?.height === 'tall';
  const heightCls = tall ? 'min-h-[480px] md:min-h-[640px]' : 'min-h-[320px] md:min-h-[440px]';

  return (
    <section className={`relative w-full bg-gradient-to-br from-[#F2F9F1] to-white ${heightCls} flex items-center`}>
      {videoBlock?.content?.src ? (
        <video
          src={videoBlock.content.src}
          poster={videoBlock.content.thumbnail}
          className="absolute inset-0 w-full h-full object-cover opacity-30"
          autoPlay muted loop playsInline preload="metadata"
        />
      ) : null}
      <div className="relative z-10 w-full max-w-6xl mx-auto px-6 text-center">
        {headline ? (
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-open-sauce-bold text-[#0F3B0F] mb-4">
            {headline}
          </h1>
        ) : null}
        {sub ? (
          <p className="text-base md:text-xl text-[#26472B] mb-8 max-w-2xl mx-auto">
            {sub}
          </p>
        ) : null}
        {ctaLabel ? (
          <Link
            href={ctaTarget}
            className="inline-block px-8 py-3 rounded-full bg-[#45A735] text-white font-open-sauce-semibold text-lg hover:bg-[#0F3B0F] transition-colors"
          >
            {ctaLabel}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
