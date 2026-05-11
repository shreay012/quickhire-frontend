'use client';

/**
 * CMS Media Library — Phase F (2026-05-11)
 *
 * Admin UI for uploading and tagging media assets that the
 * `useCmsMedia` / `useCmsMediaResponsive` hooks resolve by logical key.
 *
 * Backend:
 *   GET    /api/cms-media           — paginated list
 *   POST   /api/cms-media           — multipart upload
 *   DELETE /api/cms-media/:id       — soft delete
 *
 * Tags + folder are the resolution surface — `useCmsMedia('homepage.hero.image')`
 * matches an asset tagged `['homepage.hero.image']` or with `folder='homepage.hero.image'`.
 * Country admins are pinned to their own country (server-side R5); super_admin
 * may upload GLOBAL assets.
 */

import { useEffect, useMemo, useState } from 'react';
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
} from '@/components/staff/ui';

const COUNTRIES = ['IN', 'AE', 'DE', 'US', 'AU'];

const KNOWN_KEYS = [
  'homepage.hero.image',
  'homepage.vibe_coding.image',
  'homepage.how_it_works.bg',
  'homepage.how_it_works.video',
  'homepage.hire_confidence.icon',
  'homepage.hire_confidence.image',
  'homepage.carousel.icon',
  'homepage.why_quick.arrow',
  'homepage.spotlights.video',
];

export default function CmsMediaAdminPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [countryFilter, setCountryFilter] = useState('');
  const [user, setUser] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const u = staffAuth.getUser();
    if (u) queueMicrotask(() => setUser(u));
  }, []);

  const isSuper = user?.role === 'super_admin';

  useEffect(() => {
    queueMicrotask(() => setLoading(true));
    let cancelled = false;
    const qs = new URLSearchParams({ pageSize: '100' });
    if (countryFilter) qs.set('country', countryFilter);
    staffApi
      .get(`/cms-media?${qs.toString()}`)
      .then((r) => {
        if (cancelled) return;
        setItems(r.data?.data || []);
      })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [countryFilter, refreshKey]);

  const reload = () => setRefreshKey((k) => k + 1);

  const counts = useMemo(() => ({
    total:  items.length,
    images: items.filter((i) => i.type === 'image').length,
    videos: items.filter((i) => i.type === 'video').length,
    global: items.filter((i) => !i.country).length,
  }), [items]);

  const onDelete = async (id) => {
    if (!window.confirm('Delete this asset? Pages still using it will fall back to the hardcoded default.')) return;
    try {
      await staffApi.delete(`/cms-media/${id}`);
      showSuccess('Asset deleted');
      reload();
    } catch (e) {
      showError(e?.response?.data?.error?.message || 'Delete failed');
    }
  };

  return (
    <div>
      <PageHeader
        title="Media Library"
        subtitle="Images and videos resolved by logical key"
        helpText="Upload an asset, tag it with a logical key (e.g. homepage.hero.image), and the frontend useCmsMedia hook serves it everywhere that key is requested."
      />

      <div className="p-4 sm:p-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <StatCard label="Total assets" value={counts.total} color="green" icon="🖼️" />
          <StatCard label="Images" value={counts.images} color="green" icon="📸" />
          <StatCard label="Videos" value={counts.videos} color="green" icon="🎬" />
          <Card className="flex items-center justify-center">
            <Button variant="primary" size="md" onClick={() => setShowUpload(true)}>
              + Upload asset
            </Button>
          </Card>
        </div>

        {isSuper ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-open-sauce-semibold uppercase tracking-wider text-[#909090]">Country:</span>
            {['', ...COUNTRIES, 'GLOBAL'].map((c) => {
              const v = c === 'GLOBAL' ? '' : c; // GLOBAL = no filter (server returns global rows in all queries)
              const isActive = c === '' ? countryFilter === '' : countryFilter === c;
              return (
                <button
                  key={c || 'all'}
                  onClick={() => setCountryFilter(v)}
                  className={`px-3 py-1.5 rounded-full text-xs font-open-sauce-semibold transition-all ${
                    isActive ? 'bg-[#26472B] text-white' : 'bg-[#F2F9F1] text-[#26472B] hover:bg-[#E5F1E2]'
                  }`}
                >
                  {c || 'ALL'}
                </button>
              );
            })}
          </div>
        ) : null}

        <SectionCard title={`${items.length} asset${items.length === 1 ? '' : 's'}`}>
          {loading ? (
            <Spinner />
          ) : error ? (
            <ErrorBox error={error} />
          ) : items.length === 0 ? (
            <EmptyState
              title="No media yet"
              description="Upload your first asset and tag it with a logical key from 16-cms-content-keys.md."
              action={<Button variant="primary" size="md" onClick={() => setShowUpload(true)}>Upload first asset</Button>}
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {items.map((m) => (
                <div key={m._id} className="rounded-xl ring-1 ring-[#E5F1E2] overflow-hidden bg-white hover:shadow-md transition-shadow">
                  <div className="aspect-square bg-[#F7FBF6] flex items-center justify-center overflow-hidden">
                    {m.type === 'image' ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.url} alt={m.altText?.en || ''} className="w-full h-full object-cover" />
                    ) : m.type === 'video' ? (
                      <span className="text-4xl">🎬</span>
                    ) : (
                      <span className="text-4xl">📄</span>
                    )}
                  </div>
                  <div className="p-3 space-y-1">
                    <div className="flex items-center gap-1 flex-wrap">
                      {m.country ? (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-open-sauce-bold bg-[#F2F9F1] text-[#26472B] ring-1 ring-[#D6EBCF]">
                          {m.country}
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-open-sauce-bold bg-blue-50 text-blue-700 ring-1 ring-blue-200">
                          GLOBAL
                        </span>
                      )}
                      {m.folder ? (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-[#FFF7E0] text-[#8B6914] ring-1 ring-[#FFE9A0] truncate max-w-full" title={m.folder}>
                          {m.folder}
                        </span>
                      ) : null}
                    </div>
                    {Array.isArray(m.tags) && m.tags.length ? (
                      <div className="flex gap-1 flex-wrap">
                        {m.tags.slice(0, 2).map((t, i) => (
                          <span key={i} className="text-[9px] font-mono text-[#636363] truncate max-w-full">{t}</span>
                        ))}
                      </div>
                    ) : null}
                    <div className="flex items-center gap-1 mt-2">
                      <a
                        href={m.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-[#45A735] hover:underline truncate flex-1"
                      >
                        Open ↗
                      </a>
                      <button
                        onClick={() => onDelete(m._id)}
                        className="text-[10px] text-red-600 hover:text-red-800"
                        title="Delete"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {showUpload ? (
        <UploadModal
          canSwitchCountry={isSuper}
          ownCountry={user?.country || ''}
          onClose={() => setShowUpload(false)}
          onUploaded={() => { setShowUpload(false); reload(); }}
        />
      ) : null}
    </div>
  );
}

/* ── Upload modal ──────────────────────────────────────────────── */

function UploadModal({ canSwitchCountry, ownCountry, onClose, onUploaded }) {
  const [file, setFile]   = useState(null);
  const [folder, setFolder] = useState('');
  const [tags, setTags] = useState('');     // comma-separated, sent as JSON array
  const [country, setCountry] = useState(ownCountry || '');
  const [altEn, setAltEn] = useState('');
  const [busy, setBusy]   = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!file) { showError('Pick a file first'); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (folder) fd.append('folder', folder);
      const tagArr = tags.split(',').map((s) => s.trim()).filter(Boolean);
      if (tagArr.length) fd.append('tags', JSON.stringify(tagArr));
      if (canSwitchCountry && country) fd.append('country', country);
      if (altEn) fd.append('altText', JSON.stringify({ en: altEn }));

      await staffApi.post('/cms-media', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      showSuccess('Asset uploaded');
      onUploaded();
    } catch (e2) {
      showError(e2?.response?.data?.error?.message || 'Upload failed');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 space-y-4"
      >
        <div>
          <h2 className="text-lg font-open-sauce-bold text-[#26472B]">Upload media asset</h2>
          <p className="text-xs text-[#636363] mt-1">
            25 MB max. Images get mobile/tablet/desktop variants auto-generated.
          </p>
        </div>

        <div>
          <label className="block text-xs font-open-sauce-semibold text-[#26472B] mb-1">File</label>
          <input
            type="file"
            required
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#45A735] file:text-white file:font-open-sauce-semibold file:text-xs hover:file:bg-[#0F3B0F]"
          />
        </div>

        <div>
          <label className="block text-xs font-open-sauce-semibold text-[#26472B] mb-1">
            Logical key (folder) — what useCmsMedia(&apos;…&apos;) will resolve to this asset
          </label>
          <input
            type="text"
            placeholder="homepage.hero.image"
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[#D6EBCF] focus:outline-none focus:ring-2 focus:ring-[#45A735]/30 focus:border-[#45A735] font-mono text-sm"
          />
          <div className="flex flex-wrap gap-1 mt-2">
            {KNOWN_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setFolder(k)}
                className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#F2F9F1] text-[#26472B] hover:bg-[#D6EBCF]"
              >
                {k}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-open-sauce-semibold text-[#26472B] mb-1">
            Tags (comma-separated) — additional resolution keys
          </label>
          <input
            type="text"
            placeholder="homepage.hero.image, hero-banner"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[#D6EBCF] focus:outline-none focus:ring-2 focus:ring-[#45A735]/30 focus:border-[#45A735] text-sm"
          />
        </div>

        {canSwitchCountry ? (
          <div>
            <label className="block text-xs font-open-sauce-semibold text-[#26472B] mb-1">Country (empty = GLOBAL)</label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#D6EBCF] focus:outline-none focus:ring-2 focus:ring-[#45A735]/30 focus:border-[#45A735] text-sm"
            >
              <option value="">GLOBAL (no country tag)</option>
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        ) : (
          <div className="text-xs text-[#636363] bg-[#F7FBF6] rounded-lg px-3 py-2 ring-1 ring-[#E5F1E2]">
            Uploading to country <strong>{ownCountry}</strong> (your assigned country).
          </div>
        )}

        <div>
          <label className="block text-xs font-open-sauce-semibold text-[#26472B] mb-1">
            Alt text (English, for accessibility)
          </label>
          <input
            type="text"
            placeholder="Hero illustration — team at work"
            value={altEn}
            onChange={(e) => setAltEn(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[#D6EBCF] focus:outline-none focus:ring-2 focus:ring-[#45A735]/30 focus:border-[#45A735] text-sm"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="subtle" size="md" onClick={onClose} type="button" disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" size="md" type="submit" disabled={busy || !file}>
            {busy ? 'Uploading…' : 'Upload'}
          </Button>
        </div>
      </form>
    </div>
  );
}
