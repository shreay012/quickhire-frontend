'use client';
/**
 * Finance · Reconciliation
 *
 * Compares our internal payment ledger against gateway-side records to
 * surface discrepancies. The backend exposes `/admin-ops/reconcile` for
 * the diff (per `Updated docs/modules/payment.md`). This page is a
 * read-only dashboard — it does not auto-fix anything.
 */
import { useEffect, useState } from 'react';
import staffApi from '@/lib/axios/staffApi';
import { PageHeader, Spinner, ErrorBox, EmptyState, SectionCard, StatusBadge } from '@/components/staff/ui';

export default function FinanceReconciliationPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    staffApi.get('/admin-ops/reconcile?days=7')
      .then((r) => setData(r.data?.data || null))
      .catch((e) => setError(e))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader
        title="Reconciliation"
        subtitle="Last 7 days · gateway vs ledger diff"
        helpText="If a row shows up here, the gateway and our ledger disagree on the amount, status, or existence of a payment. Investigate before approving any related refund."
      />
      <div className="p-4 sm:p-8 space-y-4">
        {loading ? (
          <Spinner />
        ) : error ? (
          <ErrorBox error={error} />
        ) : !data || (Array.isArray(data?.discrepancies) && data.discrepancies.length === 0) ? (
          <SectionCard title="All clear">
            <EmptyState
              message="No discrepancies in the last 7 days"
              description="Internal ledger matches gateway records exactly. Re-check tomorrow."
            />
          </SectionCard>
        ) : (
          <SectionCard
            title={`${data.discrepancies?.length || 0} discrepancies`}
            subtitle="Each row needs human review"
          >
            <div className="space-y-2">
              {(data.discrepancies || []).map((d, i) => (
                <div key={d.paymentId || i} className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-amber-50 ring-1 ring-amber-200">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-open-sauce-semibold text-[#26472B] truncate">
                      {d.paymentId || 'Unknown payment'}
                    </div>
                    <div className="text-xs text-[#636363] truncate">
                      {d.kind || 'amount mismatch'} · {d.country || '—'}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 text-xs font-open-sauce">
                    <span>
                      Ledger: <strong className="text-[#26472B]">{d.ledger ?? '—'}</strong>
                    </span>
                    <span>
                      Gateway: <strong className="text-amber-700">{d.gateway ?? '—'}</strong>
                    </span>
                    <StatusBadge status={d.severity || 'warning'} />
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  );
}
