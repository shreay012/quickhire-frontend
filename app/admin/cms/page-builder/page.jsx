'use client';

/**
 * Page Builder — Phase G list of CMS pages (new system).
 *
 * Calls `/api/cms-pages/admin/pages` which is the Phase 3 / Phase G
 * pages-sections-blocks backend. Each row links to the dedicated
 * builder editor at `/admin/cms/pages/[id]` (which is also re-exported
 * under each shell's `cms/page-builder/[id]`).
 *
 * The OLD legacy CMS-x list at `/admin/cms/pages/page.jsx` remains for
 * the legacy single-document CMS flow; this file is purpose-built for
 * the Page Builder nav entry, calling the new endpoint where the 30
 * seeded customer-facing pages actually live.
 *
 * Country scoping is server-enforced:
 *   • super_admin → sees all 30 pages (5 countries × 6 slugs)
 *   • country admin (IN) → sees only their 6 IN pages
 *
 * URL pattern is shell-aware so the Build button keeps the operator
 * inside whichever portal wraps this page.
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import staffApi, { staffAuth } from '@/lib/axios/staffApi';
import { showSuccess, showError } from '@/lib/utils/toast';
import {
  PageHeader,
  StatCard,
  Spinner,
  ErrorBox,
  Button,
  EmptyState,
  SectionCard,
  Card,
  StatusBadge,
} from '@/components/staff/ui';

const COUNTRIES = [
  { code: 'IN', flag: '🇮🇳' },
  { code: 'AE', flag: '🇦🇪' },
  { code: 'DE', flag: '🇩🇪' },
  { code: 'US', flag: '🇺🇸' },
  { code: 'AU', flag: '🇦🇺' },
];

const KNOWN_SLUGS = [
  'homepage',
  'about-us',
  'contact-us',
  'how-it-works',
  'faq',
  'book-your-resource',
];

export default function PageBuilderListPage() {
  const router = useRouter();
  const pathname = usePathname();

  const [pages, setPages] = useState(null);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [user, setUser] = useState(null);
  const [countryFilter, setCountryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [newOpen, setNewOpen] = useState(false);

  useEffect(() => {
    const u = staffAuth.getUser();
    if (u) queueMicrotask(() => setUser(u));
  }, []);

  // Shell-aware base for navigating into the builder editor.
  const builderBase = useMemo(() => {
    if (pathname?.startsWith('/super-admin/cms/page-builder')) return '/super-admin/cms/page-builder';
    const m = pathname?.match(/^\/admin\/([^/]+)\/cms\/page-builder/);
    if (m) return `/admin/${m[1]}/cms/page-builder`;
    return '/admin/cms/page-builder';
  }, [pathname]);

  const isSuper = user?.role === 'super_admin';

  useEffect(() => {
    queueMicrotask(() => setError(null));
    let cancelled = false;
    staffApi
      .get('/cms-pages/admin/pages')
      .then((r) => { if (!cancelled) setPages(r.data?.data || []); })
      .catch((e) => { if (!cancelled) setError(e); })
    return () => { cancelled = true; };
  }, [refreshKey]);

  const reload = useCallback(() => setRefreshKey((k) => k + 1), []);

  const filtered = useMemo(() => {
    let out = pages || [];
    if (countryFilter) out = out.filter((p) => p.country === countryFilter);
    if (statusFilter)  out = out.filter((p) => p.status === statusFilter);
    return out;
  }, [pages, countryFilter, statusFilter]);

  const counts = useMemo(() => ({
    all:        pages?.length ?? 0,
    published:  (pages || []).filter((p) => p.status === 'published').length,
    draft:      (pages || []).filter((p) => p.status === 'draft').length,
    archived:   (pages || []).filter((p) => p.status === 'archived').length,
  }), [pages]);

  const onDelete = async (page) => {
    if (!window.confirm(`Delete page "${page.slug}" (${page.country})? Cascades to its sections and blocks.`)) return;
    try {
      await staffApi.delete(`/cms-pages/admin/pages/${page._id}`);
      showSuccess('Page deleted');
      reload();
    } catch (e) {
      showError(e?.response?.data?.error?.message || 'Delete failed');
    }
  };

  const togglePublish = async (page) => {
    const next = page.status === 'published' ? 'draft' : 'published';
    try {
      await staffApi.patch(`/cms-pages/admin/pages/${page._id}`, { status: next });
      showSuccess(`Page is now ${next}`);
      reload();
    } catch (e) {
      showError(e?.response?.data?.error?.message || 'Status change failed');
    }
  };

  return (
    <div>
      <PageHeader
        title="Page Builder"
        subtitle="Edit customer-facing pages — sections, blocks, content."
        action={
          <Button variant="primary" size="md" onClick={() => setNewOpen(true)}>
            + New page
          </Button>
        }
      />

      <div className="p-4 sm:p-8 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Total pages" value={counts.all} hint={isSuper ? 'across all countries' : 'in your country'} color="green" icon="📄" />
          <StatCard label="Published"   value={counts.published} hint="visible to customers" color="green" icon="✓" />
          <StatCard label="Draft"        value={counts.draft}    hint="in progress" color="amber" icon="✎" />
          <StatCard label="Archived"     value={counts.archived} hint="retired" color="slate" icon="🗄" />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {isSuper ? (
            <>
              <span className="text-xs font-open-sauce-semibold uppercase tracking-wider text-[#909090]">Country:</span>
              <button
                onClick={() => setCountryFilter('')}
                className={`px-3 py-1.5 rounded-full text-xs font-open-sauce-semibold transition-all ${
                  countryFilter === '' ? 'bg-[#26472B] text-white' : 'bg-[#F2F9F1] text-[#26472B] hover:bg-[#E5F1E2]'
                }`}
              >ALL</button>
              {COUNTRIES.map((c) => (
                <button
                  key={c.code}
                  onClick={() => setCountryFilter(c.code)}
                  className={`px-3 py-1.5 rounded-full text-xs font-open-sauce-semibold transition-all ${
                    countryFilter === c.code ? 'bg-[#26472B] text-white' : 'bg-[#F2F9F1] text-[#26472B] hover:bg-[#E5F1E2]'
                  }`}
                >
                  <span aria-hidden>{c.flag}</span> {c.code}
                </button>
              ))}
            </>
          ) : (
            <span className="text-xs text-[#636363]">Showing your country&rsquo;s pages.</span>
          )}
          <span className="mx-2 text-[#D6EBCF]">|</span>
          <span className="text-xs font-open-sauce-semibold uppercase tracking-wider text-[#909090]">Status:</span>
          {['', 'published', 'draft', 'archived'].map((s) => (
            <button
              key={s || 'all'}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-open-sauce-semibold transition-all ${
                statusFilter === s ? 'bg-[#26472B] text-white' : 'bg-[#F2F9F1] text-[#26472B] hover:bg-[#E5F1E2]'
              }`}
            >
              {s ? s.toUpperCase() : 'ALL'}
            </button>
          ))}
        </div>

        {/* Page grid */}
        <SectionCard title={`${filtered.length} page${filtered.length === 1 ? '' : 's'}`}>
          {pages === null ? (
            <Spinner />
          ) : error ? (
            <ErrorBox error={error} />
          ) : filtered.length === 0 ? (
            <EmptyState
              title="No pages match this filter"
              description="Try clearing filters or click + New page above."
              action={<Button variant="primary" size="md" onClick={() => setNewOpen(true)}>Create page</Button>}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((p) => (
                <Card key={p._id} className="p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-open-sauce-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#F2F9F1] text-[#26472B] ring-1 ring-[#D6EBCF]">
                          {p.country}
                        </span>
                        <StatusBadge status={p.status} />
                      </div>
                      <div className="text-sm font-open-sauce-bold text-[#26472B] truncate">{p.slug}</div>
                      <div className="text-[11px] text-[#909090] font-mono truncate">/{p.slug}</div>
                    </div>
                  </div>

                  <div className="text-xs text-[#636363]">
                    Updated {new Date(p.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-[#F2F6F1]">
                    <Button size="sm" variant="primary" onClick={() => router.push(`${builderBase}/${p._id}`)}>
                      Build
                    </Button>
                    <Button size="sm" variant="subtle" onClick={() => togglePublish(p)}>
                      {p.status === 'published' ? 'Unpublish' : 'Publish'}
                    </Button>
                    <a
                      href={`/cms-preview/${p.slug}?country=${p.country}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#45A735] hover:underline self-center ml-auto"
                    >
                      Preview ↗
                    </a>
                    <button
                      onClick={() => onDelete(p)}
                      className="text-xs text-red-600 hover:text-red-800 self-center"
                      title="Delete page"
                    >
                      Delete
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {newOpen ? (
        <NewPageModal
          isSuper={isSuper}
          ownCountry={user?.country || ''}
          onClose={() => setNewOpen(false)}
          onCreated={(p) => {
            setNewOpen(false);
            reload();
            // Jump straight into the builder for the new page.
            router.push(`${builderBase}/${p._id}`);
          }}
        />
      ) : null}
    </div>
  );
}

/* ── New-page modal ──────────────────────────────────────────────── */

function NewPageModal({ isSuper, ownCountry, onClose, onCreated }) {
  const [country, setCountry] = useState(isSuper ? 'IN' : ownCountry);
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await staffApi.post('/cms-pages/admin/pages', {
        country,
        slug,
        title,
        status: 'draft',
      });
      showSuccess(`Page created: ${slug}`);
      onCreated(res.data?.data);
    } catch (e2) {
      showError(e2?.response?.data?.error?.message || 'Failed to create page');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-4"
      >
        <div>
          <h2 className="text-lg font-open-sauce-bold text-[#26472B]">New CMS page</h2>
          <p className="text-xs text-[#636363] mt-1">Creates an empty page. Add sections and blocks in the builder.</p>
        </div>

        {isSuper ? (
          <div>
            <label className="block text-xs font-open-sauce-semibold text-[#26472B] mb-1">Country</label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#D6EBCF] focus:outline-none focus:ring-2 focus:ring-[#45A735]/30 focus:border-[#45A735] text-sm"
            >
              {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
            </select>
          </div>
        ) : (
          <div className="text-xs text-[#636363] bg-[#F7FBF6] rounded-lg px-3 py-2 ring-1 ring-[#E5F1E2]">
            Saving to country <strong>{country || 'unknown'}</strong>.
          </div>
        )}

        <div>
          <label className="block text-xs font-open-sauce-semibold text-[#26472B] mb-1">Slug (URL path)</label>
          <input
            required
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-'))}
            placeholder="e.g. about-us"
            className="w-full px-3 py-2 rounded-lg border border-[#D6EBCF] focus:outline-none focus:ring-2 focus:ring-[#45A735]/30 focus:border-[#45A735] font-mono text-sm"
          />
          <div className="flex flex-wrap gap-1 mt-2">
            {KNOWN_SLUGS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSlug(s)}
                className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#F2F9F1] text-[#26472B] hover:bg-[#D6EBCF]"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-open-sauce-semibold text-[#26472B] mb-1">Display title</label>
          <input
            required
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. About Us"
            className="w-full px-3 py-2 rounded-lg border border-[#D6EBCF] focus:outline-none focus:ring-2 focus:ring-[#45A735]/30 focus:border-[#45A735] text-sm"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="subtle" size="md" type="button" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" size="md" type="submit" disabled={busy || !slug || !title}>
            {busy ? 'Creating…' : 'Create & open builder'}
          </Button>
        </div>
      </form>
    </div>
  );
}
