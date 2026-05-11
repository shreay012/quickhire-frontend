/**
 * Section Renderer Registry — Phase 3.6
 *
 * The CMS read API (/api/cms-pages/:slug) returns a tree shaped like:
 *
 *   { page, sections: [{ id, type, config, blocks: [{ type, content }] }] }
 *
 * The frontend's job is to render each section by looking up its
 * `type` in the registry below and delegating. Unknown types become
 * a no-op + console warning so a missing renderer never crashes the
 * page (CMS authors can add new section types faster than the frontend
 * can ship matching renderers).
 *
 * Adding a new section type:
 *   1. Build a component under ./sections/<TypeName>.jsx
 *   2. Import + register it in SECTION_RENDERERS below
 *   3. Add a new content_block type renderer if needed under ./blocks/
 *
 * Usage from a page:
 *
 *   import { useCmsPage } from '@/lib/hooks/useCmsPage';
 *   import { SectionRenderer } from '@/components/cms/section-renderer';
 *
 *   const { page, sections, loading, error } = useCmsPage('homepage');
 *   if (loading) return <Skeleton />;
 *   if (error)   return <ErrorState />;
 *   return sections.map((s) => <SectionRenderer key={s.id} section={s} />);
 */

import HeroBannerSection   from './sections/HeroBannerSection.jsx';
import ServiceGridSection  from './sections/ServiceGridSection.jsx';
import FaqSection          from './sections/FaqSection.jsx';
// Phase E (2026-05-11) — 6 more section types so operators can build richer
// pages without waiting on engineering. All renderers are pure-presentation
// (no data fetches beyond the optional axios call inside ContactSection's
// inline lead-form). They expect blocks shaped per their JSDoc header.
import TestimonialsSection from './sections/TestimonialsSection.jsx';
import ClientLogosSection  from './sections/ClientLogosSection.jsx';
import StatisticsSection   from './sections/StatisticsSection.jsx';
import VideoSection        from './sections/VideoSection.jsx';
import ContactSection      from './sections/ContactSection.jsx';
import CtaSection          from './sections/CtaSection.jsx';

/** type → React component */
const SECTION_RENDERERS = {
  hero_banner:   HeroBannerSection,
  service_grid:  ServiceGridSection,
  faq:           FaqSection,
  testimonials:  TestimonialsSection,
  client_logos:  ClientLogosSection,
  statistics:    StatisticsSection,
  video:         VideoSection,
  contact:       ContactSection,
  cta:           CtaSection,
  // Add more here as the CMS grows. Unknown types fall through to
  // <UnknownSection> below.
};

function UnknownSection({ section }) {
  if (typeof window !== 'undefined') {
    // Don't crash — surface as console warn so authors can see the gap.
    // eslint-disable-next-line no-console
    console.warn(`[CMS] No renderer for section type "${section.type}" — skipping`);
  }
  return null;
}

/**
 * <SectionRenderer section={...} />
 *
 * Picks the right component for `section.type` and renders it. Always
 * passes the same `section` prop down so renderers can read `config`
 * + `blocks` themselves.
 */
export function SectionRenderer({ section, locale = 'en' }) {
  if (!section) return null;
  if (section.enabled === false) return null;
  const Component = SECTION_RENDERERS[section.type] || UnknownSection;
  return <Component section={section} locale={locale} />;
}

export { SECTION_RENDERERS };
