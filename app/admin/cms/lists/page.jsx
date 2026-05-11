'use client';

/**
 * CMS List Editor — Phase F (2026-05-11)
 *
 * Admin UI for editing the array-shaped CMS overrides consumed by
 * `useCmsListOverlay` (client logos, testimonials, FAQ items, carousel
 * slides, tech stack logos, etc.).
 *
 * Storage:
 *   cms_publications type='list' scope=<country|GLOBAL> key=<logical-key>
 *   payload = JSON array of items.
 *
 * The editor is generic — items are edited as raw JSON for now (a
 * per-shape form-builder is Phase G material). Most lists are simple
 * `[{ key1, key2 }, ...]` arrays so JSON editing is fine in practice.
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
const SCOPES = ['GLOBAL', ...COUNTRIES];

// Common list keys we know about from `Updated docs/16-cms-content-keys.md`.
// Surfaced as quick-pick chips when creating a new override.
const KNOWN_KEYS = [
  'homepage.client_logos',
  'homepage.testimonials',
  'homepage.carousel.slides',
  'homepage.tech_stack.logos',
  'homepage.faq.items',
];

export default function CmsListsAdminPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scopeFilter, setScopeFilter] = useState('');
  const [user, setUser] = useState(null);
  const [editing, setEditing] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const u = staffAuth.getUser();
    if (u) queueMicrotask(() => setUser(u));
  }, []);

  const isSuper = user?.role === 'super_admin';

  useEffect(() => {
    queueMicrotask(() => setLoading(true));
    let cancelled = false;
    const qs = scopeFilter ? `?scope=${scopeFilter}` : '';
    staffApi
      .get(`/cms-overlay/admin/lists${qs}`)
      .then((r) => {
        if (cancelled) return;
        setItems(r.data?.data || []);
      })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [scopeFilter, refreshKey]);

  const reload = () => setRefreshKey((k) => k + 1);

  return (
    <div>
      <PageHeader
        title="List Overrides"
        subtitle="CMS-managed arrays (logos, testimonials, FAQ, carousel slides)"
        helpText="Each override is an array of items. The frontend hook useCmsListOverlay reads the latest version."
      />

      <div className="p-4 sm:p-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <StatCard label="Total lists" value={items.length} hint="latest version per key" color="green" icon="📋" />
          <StatCard
            label="Country-scoped"
            value={items.filter((i) => COUNTRIES.includes(i.scope)).length}
            color="green"
            icon="🇮🇳"
          />
          <StatCard
            label="Global"
            value={items.filter((i) => i.scope === 'GLOBAL').length}
            color="slate"
            icon="🌍"
          />
          <Card className="flex items-center justify-center">
            <Button variant="primary" size="md" onClick={() => setEditing('new')}>
              + Add list
            </Button>
          </Card>
        </div>

        {isSuper ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-open-sauce-semibold uppercase tracking-wider text-[#909090]">Scope:</span>
            {['', ...SCOPES].map((s) => (
              <button
                key={s || 'all'}
                onClick={() => setScopeFilter(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-open-sauce-semibold transition-all ${
                  scopeFilter === s ? 'bg-[#26472B] text-white' : 'bg-[#F2F9F1] text-[#26472B] hover:bg-[#E5F1E2]'
                }`}
              >
                {s || 'ALL'}
              </button>
            ))}
          </div>
        ) : null}

        <SectionCard title={`${items.length} list override${items.length === 1 ? '' : 's'}`}>
          {loading ? (
            <Spinner />
          ) : error ? (
            <ErrorBox error={error} />
          ) : items.length === 0 ? (
            <EmptyState
              title="No list overrides yet"
              description="Lists override hardcoded arrays (logos, testimonials, FAQ). Empty CMS = today's UI."
              action={
                <Button variant="primary" size="md" onClick={() => setEditing('new')}>
                  Create the first list
                </Button>
              }
            />
          ) : (
            <div className="rounded-xl ring-1 ring-[#E5F1E2] overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[#F7FBF6] text-[11px] uppercase tracking-wider text-[#909090]">
                  <tr>
                    <th className="px-4 py-2 text-left font-open-sauce-semibold">Key</th>
                    <th className="px-4 py-2 text-left font-open-sauce-semibold">Scope</th>
                    <th className="px-4 py-2 text-right font-open-sauce-semibold">Items</th>
                    <th className="px-4 py-2 text-right font-open-sauce-semibold">v</th>
                    <th className="px-4 py-2 text-right font-open-sauce-semibold"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF5EC]">
                  {items.map((r) => {
                    const len = Array.isArray(r.payload)
                      ? r.payload.length
                      : Array.isArray(r.payload?.items) ? r.payload.items.length : 0;
                    return (
                      <tr key={r._id} className="hover:bg-[#F7FBF6]">
                        <td className="px-4 py-2 font-mono text-xs text-[#26472B]">{r.key}</td>
                        <td className="px-4 py-2">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-open-sauce-bold bg-[#F2F9F1] text-[#26472B] ring-1 ring-[#D6EBCF]">
                            {r.scope}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-[#636363]">{len}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-xs text-[#909090]">{r.version}</td>
                        <td className="px-4 py-2 text-right">
                          <Button size="sm" variant="subtle" onClick={() => setEditing(r)}>
                            Edit
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      {editing ? (
        <ListEditorModal
          initial={editing === 'new' ? null : editing}
          canSwitchScope={isSuper}
          ownCountry={user?.country || ''}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
        />
      ) : null}
    </div>
  );
}

/* ── Editor modal ──────────────────────────────────────────────── */

function ListEditorModal({ initial, canSwitchScope, ownCountry, onClose, onSaved }) {
  const isEdit = !!initial;
  const [key, setKey]     = useState(initial?.key || '');
  const [scope, setScope] = useState(initial?.scope || ownCountry || 'GLOBAL');
  const initialJson = useMemo(() => {
    const arr = Array.isArray(initial?.payload)
      ? initial.payload
      : Array.isArray(initial?.payload?.items) ? initial.payload.items : [];
    return JSON.stringify(arr, null, 2);
  }, [initial]);
  const [json, setJson]   = useState(initialJson);
  const [busy, setBusy]   = useState(false);
  const [parseErr, setParseErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setParseErr('');
    let payload;
    try {
      payload = JSON.parse(json);
    } catch (e2) {
      setParseErr(`Invalid JSON: ${e2.message}`);
      return;
    }
    if (!Array.isArray(payload)) {
      setParseErr('Payload must be a JSON array.');
      return;
    }
    setBusy(true);
    try {
      await staffApi.post('/cms-overlay/admin/lists', {
        key,
        scope: canSwitchScope ? scope : undefined,
        payload,
      });
      showSuccess(`Saved ${key} (${scope}) · ${payload.length} items`);
      onSaved();
    } catch (e2) {
      showError(e2?.response?.data?.error?.message || 'Save failed');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl p-6 space-y-4"
      >
        <div>
          <h2 className="text-lg font-open-sauce-bold text-[#26472B]">
            {isEdit ? 'Edit list override' : 'Add list override'}
          </h2>
          <p className="text-xs text-[#636363] mt-1">
            Saving creates a new version. Old versions remain as audit trail.
          </p>
        </div>

        <div>
          <label className="block text-xs font-open-sauce-semibold text-[#26472B] mb-1">Logical key</label>
          <input
            required
            type="text"
            placeholder="homepage.client_logos"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            disabled={isEdit}
            className="w-full px-3 py-2 rounded-lg border border-[#D6EBCF] focus:outline-none focus:ring-2 focus:ring-[#45A735]/30 focus:border-[#45A735] font-mono text-sm disabled:bg-[#F7FBF6] disabled:text-[#909090]"
          />
          {!isEdit ? (
            <div className="flex flex-wrap gap-1 mt-2">
              {KNOWN_KEYS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKey(k)}
                  className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#F2F9F1] text-[#26472B] hover:bg-[#D6EBCF]"
                >
                  {k}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {canSwitchScope ? (
          <div>
            <label className="block text-xs font-open-sauce-semibold text-[#26472B] mb-1">Scope</label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#D6EBCF] focus:outline-none focus:ring-2 focus:ring-[#45A735]/30 focus:border-[#45A735] text-sm"
            >
              {SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        ) : (
          <div className="text-xs text-[#636363] bg-[#F7FBF6] rounded-lg px-3 py-2 ring-1 ring-[#E5F1E2]">
            Saving to scope <strong>{scope}</strong> (your country).
          </div>
        )}

        <div>
          <label className="block text-xs font-open-sauce-semibold text-[#26472B] mb-1">Items (JSON array)</label>
          <textarea
            required
            rows={14}
            value={json}
            onChange={(e) => setJson(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[#D6EBCF] focus:outline-none focus:ring-2 focus:ring-[#45A735]/30 focus:border-[#45A735] font-mono text-xs"
            spellCheck={false}
          />
          {parseErr ? <div className="text-xs text-red-700 mt-1">{parseErr}</div> : null}
          <div className="text-[11px] text-[#909090] mt-1">
            Tip: each item is an object. Shape depends on the consumer hook — e.g. logos are <code>{`{ name, src }`}</code>,
            FAQ items are <code>{`{ question, answer }`}</code>. See <code>16-cms-content-keys.md</code>.
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="subtle" size="md" onClick={onClose} type="button" disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" size="md" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save list'}
          </Button>
        </div>
      </form>
    </div>
  );
}
