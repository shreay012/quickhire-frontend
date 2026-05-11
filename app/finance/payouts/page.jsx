'use client';
/**
 * Finance · Payouts queue
 *
 * Lists payout cycles. Finance has PAYOUT_WRITE; the process action
 * hits `/admin-ops/payouts/:id/process`. Cycle calculation is server-
 * side per `Updated docs/modules/payment.md`.
 */
import { useEffect, useState } from 'react';
import staffApi from '@/lib/axios/staffApi';
import { showSuccess, showError } from '@/lib/utils/toast';
import { PageHeader, Spinner, ErrorBox, EmptyState, SectionCard, StatusBadge, Button } from '@/components/staff/ui';

export default function FinancePayoutsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    queueMicrotask(() => setLoading(true));
    let cancelled = false;
    staffApi
      .get(`/admin-ops/payouts?status=${statusFilter}&pageSize=50`)
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

  const processOne = async (id) => {
    if (!window.confirm('Process this payout cycle? This triggers gateway transfers.')) return;
    try {
      await staffApi.post(`/admin-ops/payouts/${id}/process`);
      showSuccess('Payout processing initiated');
      reload();
    } catch (e) {
      showError(e?.response?.data?.error?.message || 'Processing failed');
    }
  };

  return (
    <div>
      <PageHeader
        title="Payouts"
        subtitle="Process pending payout cycles to PMs and resources"
        helpText="Cycle math is server-side. This UI just triggers the process; the queue worker handles gateway calls."
      />
      <div className="p-4 sm:p-8 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          {['pending', 'processing', 'completed', 'failed', 'all'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s === 'all' ? '' : s)}
              className={`px-3 py-1.5 rounded-full text-xs font-open-sauce-semibold transition-all ${
                statusFilter === (s === 'all' ? '' : s)
                  ? 'bg-[#26472B] text-white'
                  : 'bg-[#F2F9F1] text-[#26472B] hover:bg-[#E5F1E2]'
              }`}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>

        <SectionCard title={`${items.length} payout${items.length === 1 ? '' : 's'}`}>
          {loading ? (
            <Spinner />
          ) : error ? (
            <ErrorBox error={error} />
          ) : items.length === 0 ? (
            <EmptyState message="No payouts in this state" description="Try a different filter." />
          ) : (
            <div className="space-y-2">
              {items.map((p) => (
                <div key={p._id} className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#F7FBF6] ring-1 ring-[#E5F1E2]">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-open-sauce-semibold text-[#26472B] truncate">
                      {p.cycleLabel || `Cycle ${String(p._id).slice(-8)}`}
                    </div>
                    <div className="text-xs text-[#636363] truncate">
                      {p.country ? `${p.country} · ` : ''}
                      {p.recipientCount ? `${p.recipientCount} recipients · ` : ''}
                      Created {new Date(p.createdAt || p.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-sm font-open-sauce-bold text-[#26472B] tabular-nums">
                      {p.currency} {(Number(p.totalAmount || p.amount) || 0).toLocaleString()}
                    </span>
                    <StatusBadge status={p.status} />
                    {p.status === 'pending' && (
                      <Button size="sm" variant="primary" onClick={() => processOne(p._id)}>
                        Process
                      </Button>
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
