/**
 * CMS Preview Route — /cms-preview/<slug>
 *
 * Renders any CMS page by slug using the section-renderer registry.
 * Lets operators preview a CMS-authored homepage / about / pricing /
 * faq before swapping the real route over.
 *
 * Country resolution order:
 *   1. ?country=IN    explicit override (super_admin preview switcher)
 *   2. cookie / geo   handled by axios interceptor
 *
 * `?includeDisabled=true` shows draft sections too (super_admin only).
 *
 * This is a lightweight wrapper — the actual rendering logic lives in
 *   components/cms/section-renderer/index.jsx
 *
 * Phase 3.6.
 */

'use client';

import { useSearchParams } from 'next/navigation';
import { use } from 'react';
import { useCmsPage } from '@/lib/hooks/useCmsPage';
import { SectionRenderer } from '@/components/cms/section-renderer';
import CountryPreviewSwitcher from '@/components/cms/CountryPreviewSwitcher';

export default function CmsPreviewPage({ params }) {
  // Next.js 15+: params is a Promise
  const { slug } = use(params);
  const search = useSearchParams();
  const country = search.get('country') || undefined;
  const includeDisabled = search.get('includeDisabled') === 'true';

  const { page, sections, loading, error, refresh } = useCmsPage(slug, { country, includeDisabled });

  if (loading) {
    return (
      <main className="w-full min-h-screen flex items-center justify-center bg-[#F9FBF9]">
        <div className="animate-pulse text-[#909090] text-sm">Loading {slug}…</div>
      </main>
    );
  }
  if (error) {
    return (
      <main className="w-full min-h-screen flex items-center justify-center px-6 bg-[#F9FBF9]">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-open-sauce-bold text-[#26472B] mb-2">CMS preview failed</h1>
          <p className="text-sm text-[#636363] mb-4">{error}</p>
          <button onClick={refresh} className="px-4 py-2 rounded-lg border border-[#45A735] text-[#26472B] text-sm hover:bg-[#F2F9F1]">
            Retry
          </button>
          <p className="mt-4 text-xs text-[#909090]">
            Slug: <code className="bg-[#F5F5F5] px-1.5 py-0.5 rounded">{slug}</code>
            {country ? <> · Country override: <code className="bg-[#F5F5F5] px-1.5 py-0.5 rounded">{country}</code></> : null}
          </p>
        </div>
      </main>
    );
  }
  return (
    <main className="w-full min-h-screen bg-white">
      {/* Preview banner — only visible in preview route, not in production homepage */}
      <div className="w-full bg-amber-50 border-b border-amber-200 text-xs text-amber-900 px-4 py-2 flex flex-wrap items-center justify-center gap-3">
        <span>
          CMS preview · slug=<code>{slug}</code>
          {page?.country ? <> · country=<code>{page.country}</code></> : null}
          {includeDisabled ? ' · draft sections visible' : null}
        </span>
        <CountryPreviewSwitcher />
        <a href={`/api/cms-pages/${slug}${country ? `?country=${country}` : ''}`} target="_blank" rel="noopener" className="underline">
          raw payload ↗
        </a>
      </div>
      {sections.map((s) => (
        <SectionRenderer key={s.id} section={s} />
      ))}
      {!sections.length ? (
        <div className="max-w-2xl mx-auto px-6 py-24 text-center text-[#636363]">
          This page has no sections yet. Create some via the admin page builder.
        </div>
      ) : null}
    </main>
  );
}
