'use client';
/**
 * Finance · Refunds queue
 *
 * Lists refund requests. Finance has REFUND_APPROVE; the approve/reject
 * actions hit `/admin-ops/refunds/:id/approve` and `/reject`. We surface
 * the action buttons inline so triage is one-click.
 */
import { useEffect, useState } from 'react';
import staffApi from '@/lib/axios/staffApi';
import { showSuccess, showError } from '@/lib/utils/toast';
import { PageHeader, Spinner, ErrorBox, EmptyState, SectionCard, StatusBadge, Button } from '@/components/staff/ui';

export default function FinanceRefundsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('pending_approval');
  // Bumped to force a refetch from action handlers without re-toggling the filter
  const [refreshKey, setRefreshKey] = useState(0);

  // Effect-driven load — keeps setState calls inside the promise resolution
  // (and the loading flip inside queueMicrotask) so we don't trigger the
  // react-hooks/set-state-in-effect rule.
  useEffect(() => {
    queueMicrotask(() => setLoading(true));
    let cancelled = false;
    staffApi
      .get(`/admin-ops/refunds?status=${statusFilter}&pageSize=50`)
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
  }, [statusFilter, refreshKey]);

  const reload = () => setRefreshKey((k) => k + 1);

  const approve = async (id) => {
    try {
      await staffApi.post(`/admin-ops/refunds/${id}/approve`);
      showSuccess('Refund approved');
      reload();
    } catch (e) {
      showError(e?.response?.data?.error?.message || 'Approval failed');
    }
  };

  const reject = async (id) => {
    const reason = window.prompt('Rejection reason?');
    if (!reason) return;
    try {
      await staffApi.post(`/admin-ops/refunds/${id}/reject`, { reason });
      showSuccess('Refund rejected');
      reload();
    } catch (e) {
      showError(e?.response?.data?.error?.message || 'Rejection failed');
    }
  };

  return (
    <div>
      <PageHeader
        title="Refunds"
        subtitle="Approve or reject pending refund requests"
        helpText="Refunds are double-gated: customer requests, finance approves. Refunds are issued back to the original payment method."
      />
      <div className="p-4 sm:p-8 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          {['pending_approval', 'approved', 'rejected', 'all'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s === 'all' ? '' : s)}
              className={`px-3 py-1.5 rounded-full text-xs font-open-sauce-semibold transition-all ${
                statusFilter === (s === 'all' ? '' : s)
                  ? 'bg-[#26472B] text-white'
                  : 'bg-[#F2F9F1] text-[#26472B] hover:bg-[#E5F1E2]'
              }`}
            >
              {s.replace('_', ' ').toUpperCase()}
            </button>
          ))}
        </div>

        <SectionCard title={`${items.length} refund${items.length === 1 ? '' : 's'}`}>
          {loading ? (
            <Spinner />
          ) : error ? (
            <ErrorBox error={error} />
          ) : items.length === 0 ? (
            <EmptyState message="No refunds in this state" description="Try a different filter." />
          ) : (
            <div className="space-y-2">
              {items.map((r) => (
                <div key={r._id} className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#F7FBF6] ring-1 ring-[#E5F1E2]">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-open-sauce-semibold text-[#26472B] truncate">
                      {r.reason || 'No reason provided'}
                    </div>
                    <div className="text-xs text-[#636363] truncate">
                      {r.country ? `${r.country} · ` : ''}
                      Created {new Date(r.createdAt || r.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-sm font-open-sauce-bold text-[#26472B] tabular-nums">
                      {r.currency} {(Number(r.amount) || 0).toLocaleString()}
                    </span>
                    <StatusBadge status={r.status} />
                    {r.status === 'pending_approval' && (
                      <>
                        <Button size="sm" variant="primary" onClick={() => approve(r._id)}>
                          Approve
                        </Button>
                        <Button size="sm" variant="subtle" onClick={() => reject(r._id)}>
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
