/**
 * ClientLogosSection — Phase E (2026-05-10)
 *
 * Marquee or static grid of client logos.
 *
 * Expected blocks:
 *   { type: 'client_logo', content: { name: string, src: string, href?: string } }
 *
 * Section config (optional):
 *   { title: i18n, layout: 'marquee' | 'grid', greyscale: bool }
 */

'use client';

import Image from 'next/image';
import Link from 'next/link';
import { findBlocks, findBlock, pickI18n } from '../blocks.js';

export default function ClientLogosSection({ section, locale = 'en' }) {
  const titleBlock = findBlock(section, 'section_title');
  const logos = findBlocks(section, 'client_logo');
  const layout = section?.config?.layout || 'marquee';
  const greyscale = !!section?.config?.greyscale;
  const title = pickI18n(titleBlock?.content?.title, locale);

  if (!logos.length) return null;

  const filterCls = greyscale ? 'grayscale opacity-70 hover:grayscale-0 hover:opacity-100' : '';

  // Skip blocks that don't have an actual image URL — Next 16's <Image>
  // throws on empty-string src. A freshly-added "client_logo" block in
  // the page-builder starts with content={} until an editor uploads
  // the asset, so we render nothing rather than crash.
  const usable = logos.filter((b) => typeof b?.content?.src === 'string' && b.content.src.trim().length > 0);
  if (!usable.length && !title) return null;

  // Marquee uses CSS animation; double the array for seamless loop.
  const marquee = layout === 'marquee';
  const renderLogo = (b, i) => {
    const inner = (
      <Image
        src={b.content.src}
        alt={b.content?.name || ''}
        width={120}
        height={48}
        className={`h-10 md:h-12 w-auto object-contain transition-all ${filterCls}`}
      />
    );
    return b.content?.href ? (
      <Link key={`${b.id || i}-${marquee ? 'a' : ''}`} href={b.content.href} className="shrink-0">{inner}</Link>
    ) : (
      <span key={`${b.id || i}-${marquee ? 'a' : ''}`} className="shrink-0">{inner}</span>
    );
  };

  return (
    <section className="w-full py-12 px-6 bg-[#F7FBF6]">
      <div className="max-w-6xl mx-auto">
        {title ? (
          <h2 className="text-center text-xs md:text-sm font-open-sauce-semibold uppercase tracking-wider text-[#909090] mb-6">
            {title}
          </h2>
        ) : null}
        {marquee ? (
          <div className="overflow-hidden">
            <div className="flex gap-12 animate-cms-marquee" style={{ width: 'max-content' }}>
              {usable.map(renderLogo)}
              {usable.map((b, i) => renderLogo(b, `${i}-dup`))}
            </div>
            <style jsx>{`
              @keyframes cms-marquee {
                from { transform: translateX(0); }
                to   { transform: translateX(-50%); }
              }
              .animate-cms-marquee { animation: cms-marquee 40s linear infinite; }
              .animate-cms-marquee:hover { animation-play-state: paused; }
            `}</style>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-8 items-center justify-items-center">
            {usable.map(renderLogo)}
          </div>
        )}
      </div>
    </section>
  );
}
