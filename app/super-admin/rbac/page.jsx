'use client';

import { useEffect, useState, useCallback } from 'react';
import staffApi from '@/lib/axios/staffApi';
import { showError, showSuccess } from '@/lib/utils/toast';
import {
  PageHeader,
  Table,
  Spinner,
  ErrorBox,
  Button,
  EmptyState,
} from '@/components/staff/ui';

// ─── Constants ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 20;

const COUNTRIES = [
  { code: 'IN', label: 'India',     flag: '🇮🇳' },
  { code: 'AE', label: 'UAE',       flag: '🇦🇪' },
  { code: 'DE', label: 'Germany',   flag: '🇩🇪' },
  { code: 'AU', label: 'Australia', flag: '🇦🇺' },
  { code: 'US', label: 'USA',       flag: '🇺🇸' },
];

const MANAGEABLE_ROLES = ['admin', 'ops', 'finance', 'support', 'growth', 'viewer', 'seo', 'super_admin'];

const ROLE_META = {
  super_admin: { bg: 'bg-red-50',    text: 'text-red-700',    label: 'Super Admin' },
  admin:       { bg: 'bg-amber-50',  text: 'text-amber-700',  label: 'Admin'       },
  ops:         { bg: 'bg-blue-50',   text: 'text-blue-700',   label: 'Ops'         },
  finance:     { bg: 'bg-green-50',  text: 'text-green-700',  label: 'Finance'     },
  support:     { bg: 'bg-sky-50',    text: 'text-sky-700',    label: 'Support'     },
  growth:      { bg: 'bg-purple-50', text: 'text-purple-700', label: 'Growth'      },
  viewer:      { bg: 'bg-gray-100',  text: 'text-gray-600',   label: 'Viewer'      },
  seo:         { bg: 'bg-orange-50', text: 'text-orange-700', label: 'SEO'         },
};

const COUNTRY_TABS = [
  { code: '', label: 'All Countries' },
  ...COUNTRIES,
];

const ROLE_TABS = [
  { value: '', label: 'All Roles' },
  ...MANAGEABLE_ROLES.filter(r => r !== 'super_admin').map(r => ({
    value: r, label: ROLE_META[r]?.label || r,
  })),
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function getInitials(name) {
  // Phase fix (2026-05-11): default-parameter only applies when arg is
  // undefined; passing null still crashes on .trim(). Coerce defensively.
  name = String(name == null ? '' : name);
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?';
}
function countryLabel(code) {
  return COUNTRIES.find(c => c.code === code) || { flag: '🌐', label: code || 'Global' };
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function RoleBadge({ role }) {
  const cfg = ROLE_META[role] || { bg: 'bg-gray-100', text: 'text-gray-600', label: role };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-open-sauce-semibold uppercase tracking-wider ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

function CountryBadge({ code }) {
  if (!code) return <span className="text-xs text-[#909090] font-open-sauce">Global</span>;
  const c = countryLabel(code);
  return (
    <span className="inline-flex items-center gap-1 text-sm font-open-sauce-semibold text-[#26472B]">
      <span>{c.flag}</span>
      <span>{c.label}</span>
    </span>
  );
}

function StaffCell({ user }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#45A735] to-[#26472B] text-white text-xs font-open-sauce-bold flex items-center justify-center flex-shrink-0 select-none">
        {getInitials(user.name)}
      </div>
      <div className="min-w-0">
        <div className="font-open-sauce-semibold text-[#26472B] truncate">{user.name || '—'}</div>
        <div className="text-xs text-[#909090] font-open-sauce">{user.mobile || ''}</div>
      </div>
    </div>
  );
}

// Country breakdown summary cards
function CountrySummary({ byCountry }) {
  if (!byCountry?.length) return null;

  const grouped = {};
  byCountry.forEach(({ country, role, count }) => {
    const key = country || 'global';
    if (!grouped[key]) grouped[key] = { country, roles: {} };
    grouped[key].roles[role] = count;
  });

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
      {COUNTRIES.map(({ code, label, flag }) => {
        const g = grouped[code];
        if (!g) return null;
        const adminCount    = g.roles['admin']   || 0;
        const opsCount      = g.roles['ops']     || 0;
        const financeCount  = g.roles['finance'] || 0;
        const supportCount  = g.roles['support'] || 0;
        const othersCount   = Object.entries(g.roles)
          .filter(([r]) => !['admin','ops','finance','support'].includes(r))
          .reduce((s, [, n]) => s + n, 0);

        return (
          <div key={code} className="bg-white rounded-2xl border border-[#E5F1E2] p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">{flag}</span>
              <span className="font-open-sauce-bold text-[#26472B] text-sm">{label}</span>
            </div>
            <div className="space-y-1 text-xs font-open-sauce text-[#636363]">
              {adminCount   > 0 && <div className="flex justify-between"><span>Admin</span><span className="font-open-sauce-semibold text-[#26472B]">{adminCount}</span></div>}
              {opsCount     > 0 && <div className="flex justify-between"><span>Ops</span><span className="font-open-sauce-semibold text-[#26472B]">{opsCount}</span></div>}
              {financeCount > 0 && <div className="flex justify-between"><span>Finance</span><span className="font-open-sauce-semibold text-[#26472B]">{financeCount}</span></div>}
              {supportCount > 0 && <div className="flex justify-between"><span>Support</span><span className="font-open-sauce-semibold text-[#26472B]">{supportCount}</span></div>}
              {othersCount  > 0 && <div className="flex justify-between"><span>Others</span><span className="font-open-sauce-semibold text-[#26472B]">{othersCount}</span></div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Create / Edit modal
function StaffModal({ open, initial, onClose, onSaved }) {
  const isEdit = !!initial?._id;
  const [form, setForm] = useState({ name: '', mobile: '', email: '', role: 'admin', country: 'IN' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initial
        ? { name: initial.name || '', mobile: initial.mobile || '', email: initial.email || '', role: initial.role || 'admin', country: initial.country || '' }
        : { name: '', mobile: '', email: '', role: 'admin', country: 'IN' },
      );
    }
  }, [open, initial]);

  if (!open) return null;

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (isEdit) {
        await staffApi.patch(`/admin/rbac/staff/${initial._id}`, {
          role:    form.role    || undefined,
          country: form.country || null,
          name:    form.name    || undefined,
          email:   form.email   || undefined,
        });
        showSuccess('Staff member updated.');
      } else {
        await staffApi.post('/admin/rbac/staff', form);
        showSuccess('Staff member created.');
      }
      onSaved();
      onClose();
    } catch (err) {
      showError(err?.response?.data?.error?.message || 'Failed to save.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-open-sauce-bold text-[#26472B]">
            {isEdit ? 'Edit Staff Member' : 'Add Staff Member'}
          </h2>
          <button onClick={onClose} className="text-[#909090] hover:text-[#484848]">
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth={2} strokeLinecap="round"/></svg>
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-open-sauce-semibold text-[#636363] mb-1">Name</label>
            <input value={form.name} onChange={set('name')} required minLength={2}
              className="w-full border border-[#E5F1E2] rounded-xl px-3 py-2 text-sm font-open-sauce focus:ring-2 focus:ring-[#45A735]/30 focus:border-[#45A735] focus:outline-none"
              placeholder="Full name" />
          </div>
          {!isEdit && (
            <div>
              <label className="block text-xs font-open-sauce-semibold text-[#636363] mb-1">Mobile (10 digits)</label>
              <input value={form.mobile} onChange={set('mobile')} required pattern="\d{10}"
                className="w-full border border-[#E5F1E2] rounded-xl px-3 py-2 text-sm font-open-sauce focus:ring-2 focus:ring-[#45A735]/30 focus:border-[#45A735] focus:outline-none"
                placeholder="9876543210" />
            </div>
          )}
          <div>
            <label className="block text-xs font-open-sauce-semibold text-[#636363] mb-1">Email</label>
            <input value={form.email} onChange={set('email')} type="email"
              className="w-full border border-[#E5F1E2] rounded-xl px-3 py-2 text-sm font-open-sauce focus:ring-2 focus:ring-[#45A735]/30 focus:border-[#45A735] focus:outline-none"
              placeholder="optional" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-open-sauce-semibold text-[#636363] mb-1">Role</label>
              <select value={form.role} onChange={set('role')} required
                className="w-full border border-[#E5F1E2] rounded-xl px-3 py-2 text-sm font-open-sauce focus:ring-2 focus:ring-[#45A735]/30 focus:border-[#45A735] focus:outline-none bg-white">
                {MANAGEABLE_ROLES.filter(r => r !== 'super_admin').map(r => (
                  <option key={r} value={r}>{ROLE_META[r]?.label || r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-open-sauce-semibold text-[#636363] mb-1">Country</label>
              <select value={form.country} onChange={set('country')}
                className="w-full border border-[#E5F1E2] rounded-xl px-3 py-2 text-sm font-open-sauce focus:ring-2 focus:ring-[#45A735]/30 focus:border-[#45A735] focus:outline-none bg-white">
                <option value="">Global (no scope)</option>
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>{c.flag} {c.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit" variant="primary" loading={busy} disabled={busy} className="flex-1">
              {isEdit ? 'Update' : 'Create'}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function RbacStaffPage() {
  const [items, setItems]       = useState(null);
  const [byCountry, setByCountry] = useState([]);
  const [error, setError]       = useState(null);
  const [country, setCountry]   = useState('');
  const [role, setRole]         = useState('');
  const [page, setPage]         = useState(1);
  const [meta, setMeta]         = useState({ total: 0, pageSize: PAGE_SIZE });
  const [modal, setModal]       = useState({ open: false, initial: null });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [busy, setBusy]         = useState({});

  const load = useCallback(() => {
    setItems(null);
    setError(null);
    const params = { page, pageSize: PAGE_SIZE };
    if (country) params.country = country;
    if (role)    params.role    = role;
    staffApi
      .get('/admin/rbac/staff', { params })
      .then(r => {
        setItems(r.data?.data ?? []);
        setMeta(r.data?.meta ?? { total: 0, pageSize: PAGE_SIZE });
        setByCountry(r.data?.byCountry ?? []);
      })
      .catch(setError);
  }, [page, country, role]);

  useEffect(() => { setPage(1); }, [country, role]);
  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    setBusy(b => ({ ...b, [id]: true }));
    try {
      await staffApi.delete(`/admin/rbac/staff/${id}`);
      showSuccess('Staff member removed.');
      setDeleteConfirm(null);
      load();
    } catch (err) {
      showError(err?.response?.data?.error?.message || 'Failed to remove.');
    } finally {
      setBusy(b => ({ ...b, [id]: false }));
    }
  };

  const total      = meta?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from       = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to         = Math.min(page * PAGE_SIZE, total);

  const columns = [
    {
      key: 'staff',
      label: 'Staff Member',
      render: r => <StaffCell user={r} />,
    },
    {
      key: 'role',
      label: 'Role',
      render: r => <RoleBadge role={r.role} />,
    },
    {
      key: 'country',
      label: 'Country',
      render: r => <CountryBadge code={r.country} />,
    },
    {
      key: 'email',
      label: 'Email',
      render: r => (
        <span className="text-sm text-[#636363] font-open-sauce truncate max-w-[180px] block">
          {r.email || '—'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: r => {
        const s = r.meta?.status || 'active';
        return (
          <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-open-sauce-semibold uppercase tracking-wider ${
            s === 'active' ? 'bg-[#F2F9F1] text-[#26472B]' : 'bg-red-50 text-red-700'
          }`}>{s}</span>
        );
      },
    },
    {
      key: 'createdAt',
      label: 'Added',
      render: r => (
        <span className="text-sm text-[#636363] font-open-sauce whitespace-nowrap">{fmtDate(r.createdAt)}</span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: r => {
        if (r.role === 'super_admin') {
          return <span className="text-xs text-[#909090] font-open-sauce italic">Protected</span>;
        }
        const isConfirming = deleteConfirm === r._id;
        return (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setModal({ open: true, initial: r })}>
              Edit
            </Button>
            {isConfirming ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-[#EF4444] font-open-sauce-semibold whitespace-nowrap">Confirm?</span>
                <Button size="sm" variant="danger" loading={busy[r._id]} onClick={() => handleDelete(r._id)}>Yes</Button>
                <Button size="sm" variant="ghost" onClick={() => setDeleteConfirm(null)}>No</Button>
              </div>
            ) : (
              <Button size="sm" variant="danger" onClick={() => setDeleteConfirm(r._id)}>Remove</Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="min-h-screen bg-[#F5F7F5]">
      <PageHeader
        title="Staff Management"
        subtitle="Country-wise admin roles — super admin sees all countries"
        helpText="super_admin can see and manage staff across all countries. Each staff member is scoped to one country and can only access data from that country."
        action={
          <Button variant="primary" onClick={() => setModal({ open: true, initial: null })}>
            + Add Staff
          </Button>
        }
      />

      {/* Country summary cards */}
      <div className="px-4 sm:px-8 pt-6">
        <CountrySummary byCountry={byCountry} />
      </div>

      {/* Country filter tabs */}
      <div className="px-4 sm:px-8 bg-white border-b border-[#E5F1E2]">
        <div className="flex gap-2 flex-wrap py-3">
          {COUNTRY_TABS.map(tab => (
            <button
              key={tab.code}
              onClick={() => setCountry(tab.code)}
              className={
                country === tab.code
                  ? 'bg-[#45A735] text-white rounded-full px-4 py-1.5 text-sm font-open-sauce-semibold transition-all'
                  : 'bg-white text-[#636363] border border-[#E5F1E2] rounded-full px-4 py-1.5 text-sm font-open-sauce-medium hover:border-[#45A735] transition-all'
              }
            >
              {tab.flag ? `${tab.flag} ` : ''}{tab.label}
            </button>
          ))}
        </div>

        {/* Role filter tabs */}
        <div className="flex gap-2 flex-wrap pb-3">
          {ROLE_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setRole(tab.value)}
              className={
                role === tab.value
                  ? 'bg-[#26472B] text-white rounded-full px-3 py-1 text-xs font-open-sauce-semibold transition-all'
                  : 'bg-[#F5F7F5] text-[#636363] rounded-full px-3 py-1 text-xs font-open-sauce-medium hover:bg-[#E5F1E2] transition-all'
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="p-4 sm:p-8 space-y-4">
        <ErrorBox error={error} />

        {items === null && !error && <Spinner />}
        {items !== null && items.length === 0 && (
          <EmptyState
            title="No staff found"
            description={
              country
                ? `No staff assigned to ${countryLabel(country).label}.`
                : 'No admin-level staff yet. Click "Add Staff" to create one.'
            }
            action={
              <Button variant="primary" onClick={() => setModal({ open: true, initial: null })}>
                + Add Staff
              </Button>
            }
          />
        )}
        {items !== null && items.length > 0 && (
          <Table columns={columns} rows={items} keyField="_id" />
        )}

        {/* Pagination */}
        {items !== null && total > PAGE_SIZE && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#636363] font-open-sauce">
              Showing {from}–{to} of {total} staff
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-2.5 py-1.5 rounded-lg text-sm font-open-sauce-medium text-[#636363] hover:bg-[#F2F9F1] disabled:opacity-40 disabled:cursor-not-allowed">←</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                .reduce((acc, p, idx, arr) => {
                  if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…');
                  acc.push(p); return acc;
                }, [])
                .map((p, i) => p === '…'
                  ? <span key={`e-${i}`} className="px-1 text-[#909090]">…</span>
                  : <button key={p} onClick={() => setPage(p)}
                      className={`px-2.5 py-1.5 rounded-lg text-sm font-open-sauce-medium transition-colors ${p === page ? 'bg-[#45A735] text-white' : 'text-[#636363] hover:bg-[#F2F9F1]'}`}>{p}</button>
                )}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-2.5 py-1.5 rounded-lg text-sm font-open-sauce-medium text-[#636363] hover:bg-[#F2F9F1] disabled:opacity-40 disabled:cursor-not-allowed">→</button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      <StaffModal
        open={modal.open}
        initial={modal.initial}
        onClose={() => setModal({ open: false, initial: null })}
        onSaved={load}
      />
    </div>
  );
}
