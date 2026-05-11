'use client';
/**
 * Finance · Payments list
 *
 * Read-only payment ledger. Finance role has PAYMENT_READ but no
 * payment writes here — refunds are issued via the dedicated /refunds
 * route which has its own approval workflow.
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import staffApi from '@/lib/axios/staffApi';
import { PageHeader, Spinner, ErrorBox, EmptyState, SectionCard, StatusBadge } from '@/components/staff/ui';

export default function FinancePaymentsPage() {
  const params = useSearchParams();
  const currency = params?.get('currency') || '';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const qs = new URLSearchParams({ pageSize: '50' });
    if (currency) qs.set('currency', currency);
    staffApi.get(`/admin/payments?${qs.toString()}`)
      .then((r) => setItems(r.data?.data || []))
      .catch((e) => setError(e))
      .finally(() => setLoading(false));
  }, [currency]);

  return (
    <div>
      <PageHeader
        title={currency ? `${currency} Payments` : 'All Payments'}
        subtitle="Captured + authorized · last 50"
      />
      <div className="p-4 sm:p-8">
        <SectionCard
          title="Payments"
          subtitle={currency ? `Filtered to currency = ${currency}` : 'All currencies'}
        >
          {loading ? (
            <Spinner />
          ) : error ? (
            <ErrorBox error={error} />
          ) : items.length === 0 ? (
            <EmptyState message="No payments" description="No payments match this filter." />
          ) : (
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-sm">
                <thead className="bg-[#F7FBF6] text-[11px] uppercase tracking-wider text-[#909090]">
                  <tr>
                    <th className="px-5 py-2 text-left font-open-sauce-semibold">Gateway / ID</th>
                    <th className="px-5 py-2 text-left font-open-sauce-semibold">Country</th>
                    <th className="px-5 py-2 text-right font-open-sauce-semibold">Amount</th>
                    <th className="px-5 py-2 text-left font-open-sauce-semibold">Status</th>
                    <th className="px-5 py-2 text-left font-open-sauce-semibold">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF5EC]">
                  {items.map((p) => (
                    <tr key={p._id} className="hover:bg-[#F7FBF6]">
                      <td className="px-5 py-2.5">
                        <div className="font-open-sauce-semibold text-[#26472B]">
                          {p.gateway?.toUpperCase() || '—'}
                        </div>
                        <div className="text-[11px] text-[#909090] font-open-sauce truncate max-w-[24ch]">
                          {p.gatewayPaymentId || p._id}
                        </div>
                      </td>
                      <td className="px-5 py-2.5 text-[#636363] font-open-sauce">{p.country || '—'}</td>
                      <td className="px-5 py-2.5 text-right text-[#26472B] font-open-sauce-bold tabular-nums">
                        {p.currency || ''} {(Number(p.amount) || 0).toLocaleString()}
                      </td>
                      <td className="px-5 py-2.5">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-5 py-2.5 text-[#636363] font-open-sauce">
                        {new Date(p.createdAt || p.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
