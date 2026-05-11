'use client';

/**
 * CMS Translation Editor — Phase F (2026-05-11)
 *
 * Admin UI for editing the translation overlays consumed by
 * `useTranslationsWithCms` hooks across the customer-facing pages.
 *
 * Backend: GET/POST /api/cms-overlay/admin/translations
 *
 * Workflow:
 *   1. List existing overrides scoped to the caller's country (and GLOBAL
 *      for context).
 *   2. Editor shows: namespace, key, scope (super_admin can switch),
 *      payload — either a plain string or per-locale variants (en/hi/ar/de).
 *   3. Save bumps the version; the read API picks up the new value within
 *      ~1s (cache-invalidated server-side).
 *
 * Empty state: shows a CTA to create the first override + an "import keys"
 * link to `Updated docs/16-cms-content-keys.md` so editors know what
 * logical keys exist.
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
const LOCALES = ['en', 'hi', 'ar', 'de'];

function isI18nObj(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

export default function CmsTranslationsAdminPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scopeFilter, setScopeFilter] = useState('');
  const [user, setUser] = useState(null);
  const [editing, setEditing] = useState(null);    // currently-edited row (or 'new')
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const u = staffAuth.getUser();
    if (u) queueMicrotask(() => setUser(u));
  }, []);

  const isSuper = user?.role === 'super_admin';
  const canSwitchScope = !!isSuper;

  useEffect(() => {
    queueMicrotask(() => setLoading(true));
    let cancelled = false;
    const qs = scopeFilter ? `?scope=${scopeFilter}` : '';
    staffApi
      .get(`/cms-overlay/admin/translations${qs}`)
      .then((r) => {
        if (cancelled) return;
        setItems(r.data?.data || []);
      })
      .catch((e) => {
        if (!cancelled) setError(e);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [scopeFilter, refreshKey]);

  const reload = () => setRefreshKey((k) => k + 1);

  const grouped = useMemo(() => {
    const out = {};
    for (const it of items) {
      const ns = String(it.key || '').split('.')[0] || '(no namespace)';
      if (!out[ns]) out[ns] = [];
      out[ns].push(it);
    }
    return out;
  }, [items]);

  return (
    <div>
      <PageHeader
        title="Translation Overrides"
        subtitle="CMS-managed copy that overlays next-intl translations"
        helpText="Country-specific entries override global. Empty CMS = today's hardcoded UI."
      />

      <div className="p-4 sm:p-8 space-y-6">
        {/* Top row: stats + CTA */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <StatCard label="Total overrides" value={items.length} hint="latest version per key" color="green" icon="🌐" />
          <StatCard
            label="Country-scoped"
            value={items.filter((i) => COUNTRIES.includes(i.scope)).length}
            hint="non-global"
            color="green"
            icon="🇮🇳"
          />
          <StatCard
            label="Global"
            value={items.filter((i) => i.scope === 'GLOBAL').length}
            hint="apply everywhere"
            color="slate"
            icon="🌍"
          />
          <Card className="flex items-center justify-center">
            <Button variant="primary" size="md" onClick={() => setEditing('new')}>
              + Add override
            </Button>
          </Card>
        </div>

        {/* Filter bar */}
        {canSwitchScope ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-open-sauce-semibold uppercase tracking-wider text-[#909090]">Scope:</span>
            {['', ...SCOPES].map((s) => (
              <button
                key={s || 'all'}
                onClick={() => setScopeFilter(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-open-sauce-semibold transition-all ${
                  scopeFilter === s
                    ? 'bg-[#26472B] text-white'
                    : 'bg-[#F2F9F1] text-[#26472B] hover:bg-[#E5F1E2]'
                }`}
              >
                {s || 'ALL'}
              </button>
            ))}
          </div>
        ) : (
          <div className="text-xs font-open-sauce text-[#636363]">
            You see only your country&rsquo;s + GLOBAL overrides.
          </div>
        )}

        {/* List */}
        <SectionCard title={`${items.length} override${items.length === 1 ? '' : 's'}`}>
          {loading ? (
            <Spinner />
          ) : error ? (
            <ErrorBox error={error} />
          ) : items.length === 0 ? (
            <EmptyState
              title="No overrides yet"
              description={
                'Translation overrides override next-intl strings without a deploy. ' +
                'See Updated docs/16-cms-content-keys.md for the canonical list of logical keys.'
              }
              action={
                <Button variant="primary" size="md" onClick={() => setEditing('new')}>
                  Create the first override
                </Button>
              }
            />
          ) : (
            <div className="space-y-6">
              {Object.entries(grouped).map(([ns, rows]) => (
                <div key={ns}>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-xs font-open-sauce-bold uppercase tracking-wider text-[#26472B]">{ns}</h3>
                    <span className="text-[11px] text-[#909090]">{rows.length} entr{rows.length === 1 ? 'y' : 'ies'}</span>
                  </div>
                  <div className="rounded-xl ring-1 ring-[#E5F1E2] overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-[#F7FBF6] text-[11px] uppercase tracking-wider text-[#909090]">
                        <tr>
                          <th className="px-4 py-2 text-left font-open-sauce-semibold">Key</th>
                          <th className="px-4 py-2 text-left font-open-sauce-semibold">Scope</th>
                          <th className="px-4 py-2 text-left font-open-sauce-semibold">Value</th>
                          <th className="px-4 py-2 text-right font-open-sauce-semibold">v</th>
                          <th className="px-4 py-2 text-right font-open-sauce-semibold"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EEF5EC]">
                        {rows.map((r) => (
                          <tr key={r._id} className="hover:bg-[#F7FBF6]">
                            <td className="px-4 py-2 font-mono text-xs text-[#26472B]">{r.key}</td>
                            <td className="px-4 py-2">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-open-sauce-bold bg-[#F2F9F1] text-[#26472B] ring-1 ring-[#D6EBCF]">
                                {r.scope}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-[#636363] max-w-[320px] truncate">
                              {isI18nObj(r.payload)
                                ? Object.entries(r.payload).map(([l, v]) => `[${l}] ${v}`).join(' · ')
                                : String(r.payload)}
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums text-xs text-[#909090]">{r.version}</td>
                            <td className="px-4 py-2 text-right">
                              <Button size="sm" variant="subtle" onClick={() => setEditing(r)}>
                                Edit
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {editing ? (
        <EditorModal
          initial={editing === 'new' ? null : editing}
          canSwitchScope={canSwitchScope}
          ownCountry={user?.country || ''}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
        />
      ) : null}
    </div>
  );
}

/* ── Editor modal ──────────────────────────────────────────────── */

function EditorModal({ initial, canSwitchScope, ownCountry, onClose, onSaved }) {
  const isEdit = !!initial;
  const initialNs   = isEdit ? String(initial.key || '').split('.')[0] : '';
  const initialKey  = isEdit ? String(initial.key || '').split('.').slice(1).join('.') : '';
  const [namespace, setNamespace] = useState(initialNs);
  const [key, setKey]             = useState(initialKey);
  const [scope, setScope]         = useState(initial?.scope || ownCountry || 'GLOBAL');
  const [mode, setMode]           = useState(isI18nObj(initial?.payload) ? 'i18n' : 'string');
  const [stringValue, setStringValue] = useState(typeof initial?.payload === 'string' ? initial.payload : '');
  const [i18n, setI18n] = useState(() => {
    const out = { en: '', hi: '', ar: '', de: '' };
    if (isI18nObj(initial?.payload)) Object.assign(out, initial.payload);
    return out;
  });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = mode === 'string'
        ? stringValue
        : Object.fromEntries(Object.entries(i18n).filter(([, v]) => v));
      await staffApi.post('/cms-overlay/admin/translations', {
        namespace,
        key,
        scope: canSwitchScope ? scope : undefined,
        payload,
      });
      showSuccess(`Saved ${namespace}.${key} (${scope})`);
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
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 space-y-4"
      >
        <div>
          <h2 className="text-lg font-open-sauce-bold text-[#26472B]">
            {isEdit ? 'Edit override' : 'Add override'}
          </h2>
          <p className="text-xs text-[#636363] mt-1">
            Saving creates a new version (does not overwrite history).
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-open-sauce-semibold text-[#26472B] mb-1">Namespace</label>
            <input
              required
              type="text"
              placeholder="hero"
              value={namespace}
              onChange={(e) => setNamespace(e.target.value)}
              disabled={isEdit}
              className="w-full px-3 py-2 rounded-lg border border-[#D6EBCF] focus:outline-none focus:ring-2 focus:ring-[#45A735]/30 focus:border-[#45A735] font-mono text-sm disabled:bg-[#F7FBF6] disabled:text-[#909090]"
            />
          </div>
          <div>
            <label className="block text-xs font-open-sauce-semibold text-[#26472B] mb-1">Key (after namespace)</label>
            <input
              required
              type="text"
              placeholder="text1"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              disabled={isEdit}
              className="w-full px-3 py-2 rounded-lg border border-[#D6EBCF] focus:outline-none focus:ring-2 focus:ring-[#45A735]/30 focus:border-[#45A735] font-mono text-sm disabled:bg-[#F7FBF6] disabled:text-[#909090]"
            />
          </div>
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
          <label className="block text-xs font-open-sauce-semibold text-[#26472B] mb-1">Payload</label>
          <div className="flex gap-2 mb-2">
            <button
              type="button"
              onClick={() => setMode('string')}
              className={`px-3 py-1.5 rounded-full text-xs font-open-sauce-semibold ${mode === 'string' ? 'bg-[#26472B] text-white' : 'bg-[#F2F9F1] text-[#26472B]'}`}
            >
              Plain string
            </button>
            <button
              type="button"
              onClick={() => setMode('i18n')}
              className={`px-3 py-1.5 rounded-full text-xs font-open-sauce-semibold ${mode === 'i18n' ? 'bg-[#26472B] text-white' : 'bg-[#F2F9F1] text-[#26472B]'}`}
            >
              Per-locale (i18n)
            </button>
          </div>

          {mode === 'string' ? (
            <textarea
              required
              rows={3}
              placeholder="Hire Tech Talent in 5 Minutes"
              value={stringValue}
              onChange={(e) => setStringValue(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#D6EBCF] focus:outline-none focus:ring-2 focus:ring-[#45A735]/30 focus:border-[#45A735] text-sm"
            />
          ) : (
            <div className="space-y-2">
              {LOCALES.map((l) => (
                <div key={l} className="flex items-center gap-2">
                  <span className="text-[10px] font-open-sauce-bold uppercase tracking-wider text-[#909090] w-8">{l}</span>
                  <input
                    type="text"
                    placeholder={`(${l} string — leave empty to skip)`}
                    value={i18n[l]}
                    onChange={(e) => setI18n({ ...i18n, [l]: e.target.value })}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-[#D6EBCF] focus:outline-none focus:ring-2 focus:ring-[#45A735]/30 focus:border-[#45A735] text-sm"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="subtle" size="md" onClick={onClose} type="button" disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" size="md" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save override'}
          </Button>
        </div>
      </form>
    </div>
  );
}
