'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import staffApi from '@/lib/axios/staffApi';
import { showError, showSuccess } from '@/lib/utils/toast';
import { s } from '@/lib/utils/i18nText';
import {
  PageHeader,
  Table,
  StatusBadge,
  Spinner,
  ErrorBox,
  Button,
  EmptyState,
  Pagination,
  BulkBar,
} from '@/components/staff/ui';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 15;

const STATUS_TABS = [
  { key: '',              label: 'All' },
  { key: 'pending',       label: 'Pending' },
  { key: 'confirmed',     label: 'Confirmed' },
  { key: 'assigned_to_pm',label: 'Assigned to PM' },
  { key: 'in_progress',   label: 'In Progress' },
  { key: 'completed',     label: 'Completed' },
  { key: 'cancelled',     label: 'Cancelled' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtINR(amount) {
  if (amount == null || isNaN(Number(amount))) return '—';
  return '₹' + Number(amount).toLocaleString('en-IN');
}

function fmtDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: '2-digit',
    });
  } catch {
    return '—';
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminBookingsPage() {
  const router = useRouter();

  // ─── Data state ───────────────────────────────────────────────────────────
  const [bookings, setBookings]     = useState(null);   // null = loading
  const [total, setTotal]           = useState(0);
  const [error, setError]           = useState(null);

  // ─── Filter / pagination state ────────────────────────────────────────────
  const [activeStatus, setActiveStatus] = useState('');
  const [page, setPage]                 = useState(1);

  // ─── Inline action states (no window.confirm / window.alert) ─────────────
  const [confirmTarget, setConfirmTarget] = useState(null);   // bookingId to confirm
  const [rejectTarget, setRejectTarget]   = useState(null);   // bookingId to reject

  // ─── Loading/busy states ──────────────────────────────────────────────────
  const [busyConfirm, setBusyConfirm] = useState(null);
  const [busyReject, setBusyReject]   = useState(null);

  // ─── Bulk selection ───────────────────────────────────────────────────────
  // selectedIds is a Set of booking ids. Lets the admin tick a few rows
  // and confirm / cancel them all in one shot — the most-asked-for ops
  // workflow on this page.
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const toggleSelect = (id) => setSelectedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const clearSelection = () => setSelectedIds(new Set());
  const isAllVisibleSelected =
    Array.isArray(bookings) && bookings.length > 0 &&
    bookings.every((b) => selectedIds.has(b._id));
  const toggleAllVisible = () => {
    if (!Array.isArray(bookings)) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (isAllVisibleSelected) {
        bookings.forEach((b) => next.delete(b._id));
      } else {
        bookings.forEach((b) => next.add(b._id));
      }
      return next;
    });
  };

  // Bulk confirm / cancel — fire requests in parallel and refresh once.
  // Failures are surfaced via toast with a count of how many failed so
  // the admin can decide whether to retry.
  const bulkAction = async (kind) => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    setBulkBusy(true);
    try {
      const results = await Promise.allSettled(
        ids.map((id) =>
          kind === 'confirm'
            ? staffApi.post(`/admin/bookings/${id}/confirm`)
            : staffApi.patch(`/admin/bookings/${id}/reject`, { reason: '' }),
        ),
      );
      const failed = results.filter((r) => r.status === 'rejected').length;
      const ok = results.length - failed;
      if (ok > 0) {
        showSuccess(
          `${ok} booking${ok === 1 ? '' : 's'} ${kind === 'confirm' ? 'confirmed' : 'cancelled'}.`,
        );
      }
      if (failed > 0) {
        showError(`${failed} booking${failed === 1 ? '' : 's'} failed — check status and retry.`);
      }
      clearSelection();
      await load();
    } finally {
      setBulkBusy(false);
    }
  };

  // ─── Load bookings ────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setBookings(null);
    setError(null);
    try {
      const params = { page, pageSize: PAGE_SIZE };
      if (activeStatus) params.status = activeStatus;
      const r = await staffApi.get('/admin/bookings', { params });
      const d = r.data?.data || r.data || {};
      const arr = Array.isArray(d) ? d : (Array.isArray(d.bookings) ? d.bookings : []);
      setBookings(arr);
      setTotal(typeof d.total === 'number' ? d.total : arr.length);
    } catch (e) {
      setError(e);
      setBookings([]);
    }
  }, [activeStatus, page]);

  useEffect(() => { load(); }, [load]);

  // ─── Status tab change ────────────────────────────────────────────────────
  const handleStatusChange = (key) => {
    setActiveStatus(key);
    setPage(1);
    setConfirmTarget(null);
    setRejectTarget(null);
  };

  // ─── Actions ──────────────────────────────────────────────────────────────
  const doConfirm = async (id) => {
    setBusyConfirm(id);
    try {
      await staffApi.post(`/admin/bookings/${id}/confirm`);
      showSuccess('Booking confirmed successfully.');
      setConfirmTarget(null);
      await load();
    } catch (e) {
      showError(e?.response?.data?.error?.message || e?.message || 'Failed to confirm booking.');
    } finally {
      setBusyConfirm(null);
    }
  };

  const doReject = async (id) => {
    setBusyReject(id);
    try {
      await staffApi.patch(`/admin/bookings/${id}/reject`, { reason: '' });
      showSuccess('Booking cancelled.');
      setRejectTarget(null);
      await load();
    } catch (e) {
      showError(e?.response?.data?.error?.message || e?.message || 'Failed to cancel booking.');
    } finally {
      setBusyReject(null);
    }
  };

  // ─── Table columns ────────────────────────────────────────────────────────
  // Leading checkbox column is wired into selectedIds + toggleAllVisible
  // so the admin can multi-select bookings and then trigger bulk
  // confirm / cancel from the BulkBar above the table.
  const columns = [
    {
      key: '__select',
      label: (
        <input
          type="checkbox"
          checked={isAllVisibleSelected}
          onChange={toggleAllVisible}
          className="w-4 h-4 rounded border-[#D6EBCF] text-[#45A735] focus:ring-[#45A735] cursor-pointer"
          aria-label="Select all visible"
        />
      ),
      render: (r) => (
        <input
          type="checkbox"
          checked={selectedIds.has(r._id)}
          onChange={(e) => { e.stopPropagation(); toggleSelect(r._id); }}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 rounded border-[#D6EBCF] text-[#45A735] focus:ring-[#45A735] cursor-pointer"
          aria-label={`Select booking ${String(r._id).slice(-8)}`}
        />
      ),
    },
    {
      key: 'booking',
      label: 'Booking',
      render: (r) => (
        <div>
          <div className="font-mono text-[11px] text-[#909090] tracking-wider">
            #{String(r._id).slice(-8)}
          </div>
          <div className="font-open-sauce-semibold text-[#26472B] text-sm leading-tight mt-0.5">
            {s(r.customerName) || '—'}
          </div>
        </div>
      ),
    },
    {
      key: 'service',
      label: 'Service',
      render: (r) => (
        <div>
          <div className="text-sm text-[#484848] font-open-sauce">{s(r.serviceName) || '—'}</div>
          {r.customerMobile && (
            <div className="text-xs text-[#909090] mt-0.5">{r.customerMobile}</div>
          )}
        </div>
      ),
    },
    {
      key: 'country',
      label: 'Country',
      render: (r) => (
        <span className="text-sm font-open-sauce-semibold text-[#26472B]">
          {r.country || '—'}
        </span>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (r) => (
        <span className="font-open-sauce-semibold text-[#26472B] text-sm">
          {fmtINR(r.amount)}
        </span>
      ),
    },
    {
      key: 'date',
      label: 'Date',
      render: (r) => (
        <span className="text-sm text-[#636363] font-open-sauce">
          {fmtDate(r.createdAt)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (r) => (
        <div className="flex items-center gap-1.5 flex-wrap min-w-[200px]">
          {/* Always show View → */}
          <Button
            size="sm"
            variant="subtle"
            onClick={() => router.push(`/super-admin/bookings/${r._id}`)}
          >
            View →
          </Button>

          {/* Pending: inline confirm */}
          {r.status === 'pending' && (
            <>
              {confirmTarget === r._id ? (
                <>
                  <Button
                    size="sm"
                    variant="primary"
                    loading={busyConfirm === r._id}
                    onClick={() => doConfirm(r._id)}
                  >
                    ✓ Yes
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmTarget(null)}
                    disabled={busyConfirm === r._id}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setConfirmTarget(r._id); setRejectTarget(null); }}
                >
                  Confirm
                </Button>
              )}
            </>
          )}

          {/* Reject: shown for non-terminal, non-pending statuses */}
          {!['cancelled', 'completed'].includes(r.status) && r.status !== 'pending' && rejectTarget !== r._id && (
            <Button
              size="sm"
              variant="danger"
              onClick={() => { setRejectTarget(r._id); setConfirmTarget(null); }}
            >
              Reject
            </Button>
          )}

          {/* Inline reject confirmation */}
          {rejectTarget === r._id && (
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="danger"
                loading={busyReject === r._id}
                onClick={() => doReject(r._id)}
              >
                Yes, cancel
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setRejectTarget(null)}
                disabled={busyReject === r._id}
              >
                No
              </Button>
            </div>
          )}
        </div>
      ),
    },
  ];

  // ─── Pagination helpers ───────────────────────────────────────────────────
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F5F7F5]">
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <PageHeader
        title="Bookings"
        subtitle="All customer bookings across services"
        helpText="Click any row to open the full booking detail. Use the filter pills to narrow by status."
      />

      {/* ── Status Filter Tabs ────────────────────────────────────────────── */}
      <div className="px-4 sm:px-8 pt-4 bg-white border-b border-[#E5F1E2]">
        <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
          {STATUS_TABS.map((tab) => {
            const isActive = activeStatus === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => handleStatusChange(tab.key)}
                className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs transition-all duration-200 whitespace-nowrap ${
                  isActive
                    ? 'bg-[#45A735] text-white font-open-sauce-semibold shadow-sm'
                    : 'bg-white text-[#636363] border border-[#E5F1E2] font-open-sauce-medium hover:border-[#45A735] hover:text-[#26472B]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
          {activeStatus && (
            <button
              type="button"
              onClick={() => handleStatusChange('')}
              className="flex-shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs bg-[#F7FBF6] text-[#26472B] border border-[#D6EBCF] font-open-sauce-medium hover:bg-white"
            >
              Clear filters
              <svg width={10} height={10} viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Main Content ──────────────────────────────────────────────────── */}
      <div className="p-4 sm:p-8 space-y-5">
        <ErrorBox error={error} />

        {/* Result summary line — accurate global counts via meta.total
            instead of the misleading "current-page only" stats the
            previous version showed. */}
        {bookings !== null && (
          <div className="flex items-center justify-between gap-3 flex-wrap text-sm font-open-sauce text-[#636363]">
            <div>
              <span className="font-open-sauce-semibold text-[#26472B]">
                {total.toLocaleString('en-IN')}
              </span>{' '}
              booking{total === 1 ? '' : 's'} match
              {activeStatus && (
                <>
                  {' '}
                  ·{' '}
                  <span className="text-[#26472B] font-open-sauce-semibold capitalize">
                    {activeStatus.replace(/_/g, ' ')}
                  </span>
                </>
              )}
            </div>
            <div className="text-xs text-[#909090]">
              Page {page} of {Math.max(1, totalPages)}
            </div>
          </div>
        )}

        {/* Bulk action bar — shows when at least one row is selected. */}
        {selectedIds.size > 0 && (
          <div className="flex justify-center">
            <BulkBar count={selectedIds.size} onClear={clearSelection}>
              <button
                type="button"
                onClick={() => bulkAction('confirm')}
                disabled={bulkBusy}
                className="px-3 py-1 rounded-full text-[11px] font-open-sauce-semibold bg-[#45A735] hover:bg-[#78EB54] hover:text-[#0F3B0F] transition-colors disabled:opacity-50"
              >
                {bulkBusy ? 'Working…' : 'Confirm all'}
              </button>
              <button
                type="button"
                onClick={() => bulkAction('reject')}
                disabled={bulkBusy}
                className="px-3 py-1 rounded-full text-[11px] font-open-sauce-semibold bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                Cancel all
              </button>
            </BulkBar>
          </div>
        )}

        {/* Loading skeleton */}
        {bookings === null && !error && (
          <Table columns={columns} rows={[]} loading={true} />
        )}

        {/* Table or empty state */}
        {bookings !== null && bookings.length === 0 && (
          <EmptyState
            title={activeStatus ? `No ${activeStatus.replace(/_/g, ' ')} bookings` : 'No bookings yet'}
            description={
              activeStatus
                ? "Nothing matches the current filter. Try clearing it or picking a different status."
                : 'Bookings appear here as customers place them.'
            }
            action={
              activeStatus && (
                <Button variant="subtle" size="md" onClick={() => handleStatusChange('')}>
                  Clear filter
                </Button>
              )
            }
          />
        )}

        {bookings !== null && bookings.length > 0 && (
          <Table columns={columns} rows={bookings} keyField="_id" />
        )}

        {/* Pagination */}
        {bookings !== null && total > PAGE_SIZE && (
          <Pagination page={page} total={total} pageSize={PAGE_SIZE} onChange={setPage} />
        )}
      </div>

    </div>
  );
}
