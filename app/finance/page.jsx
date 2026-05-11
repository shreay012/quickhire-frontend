'use client';
/**
 * Finance Dashboard
 *
 * Spec (per Updated docs/12-restrictions-and-permissions-matrix.md +
 *       Updated docs/14-architecture-audit.md per-role spec):
 *   • Today's revenue + by-currency rollup
 *   • Refunds pending approval
 *   • Payout cycles open
 *   • Reconciliation diff
 *   • Fraud feed
 *
 * Finance must NOT see: bookings write, services edit, CMS, SEO, blog,
 * RBAC, KYC review, chat takeover, audit log, tickets. We don't even
 * fetch those endpoints.
 *
 * Country-scope: server-side. If `req.user.country` is set, every
 * `/admin-ops/*` endpoint already filters to that country, so this UI
 * doesn't need to know the role's country.
 */

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import staffApi, { staffAuth } from '@/lib/axios/staffApi';
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

function greetingForHour(h) {
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function fmtMoney(amount, currency) {
  const n = Number(amount) || 0;
  return `${currency || ''} ${n.toLocaleString()}`.trim();
}

export default function FinanceDashboard() {
  const router = useRouter();
  const [staffName, setStaffName] = useState('');
  const [staffCountry, setStaffCountry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});

  // Aggregated state
  const [paymentsByCurrency, setPaymentsByCurrency] = useState([]);
  const [pendingRefunds, setPendingRefunds] = useState({ count: 0, items: [] });
  const [openPayouts, setOpenPayouts] = useState({ count: 0, items: [] });
  const [recentPayments, setRecentPayments] = useState([]);

  const greeting = useMemo(() => greetingForHour(new Date().getHours()), []);

  useEffect(() => {
    const u = staffAuth.getUser();
    if (u?.name) queueMicrotask(() => setStaffName(u.name));
    if (u?.country) queueMicrotask(() => setStaffCountry(u.country));

    Promise.allSettled([
      // Recent payments — used both for the list and the by-currency rollup.
      staffApi.get('/admin/payments?pageSize=50'),
      // Pending refunds awaiting approval.
      staffApi.get('/admin-ops/refunds?status=pending&pageSize=10'),
      // Open payout cycles.
      staffApi.get('/admin-ops/payouts?status=pending&pageSize=10'),
    ]).then(([paymentsRes, refundsRes, payoutsRes]) => {
      const errs = {};

      if (paymentsRes.status === 'fulfilled') {
        const arr = paymentsRes.value?.data?.data || [];
        setRecentPayments(arr.slice(0, 10));
        // Aggregate today's revenue per currency
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const buckets = {};
        for (const p of arr) {
          const d = new Date(p.createdAt || p.created_at || 0);
          if (d < today) continue;
          if (p.status !== 'captured' && p.status !== 'success' && p.status !== 'paid') continue;
          const cur = p.currency || 'USD';
          buckets[cur] = (buckets[cur] || 0) + (Number(p.amount) || 0);
        }
        setPaymentsByCurrency(
          Object.entries(buckets).map(([currency, total]) => ({ currency, total })).sort((a, b) => b.total - a.total),
        );
      } else {
        errs.payments = paymentsRes.reason;
      }

      if (refundsRes.status === 'fulfilled') {
        const arr = refundsRes.value?.data?.data || [];
        const total = refundsRes.value?.data?.meta?.total ?? arr.length;
        setPendingRefunds({ count: total, items: arr.slice(0, 5) });
      } else {
        errs.refunds = refundsRes.reason;
      }

      if (payoutsRes.status === 'fulfilled') {
        const arr = payoutsRes.value?.data?.data || [];
        const total = payoutsRes.value?.data?.meta?.total ?? arr.length;
        setOpenPayouts({ count: total, items: arr.slice(0, 5) });
      } else {
        errs.payouts = payoutsRes.reason;
      }

      setErrors(errs);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <PageHeader
        title="Finance Dashboard"
        subtitle="Revenue, refunds, and payouts at a glance"
        helpText={
          staffCountry
            ? `Scoped to ${staffCountry}. Country admins for finance see only their own country's transactions.`
            : 'Global finance view across all 5 countries. Drill into per-country payments for currency-typed totals.'
        }
      />

      <div className="p-4 sm:p-8 space-y-6">
        {/* Welcome strip */}
        <Card className="px-5 sm:px-6 py-5 bg-gradient-to-r from-[#F2F9F1] via-white to-white">
          <div className="flex items-start sm:items-center justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="text-xs text-[#909090] font-open-sauce-semibold uppercase tracking-wider mb-1">
                {greeting}
              </div>
              <h2 className="text-xl sm:text-2xl font-open-sauce-bold text-[#26472B] leading-tight">
                {staffName ? `${staffName} 👋` : 'Welcome back'}
              </h2>
              <p className="text-sm text-[#636363] mt-1">
                {pendingRefunds.count > 0 || openPayouts.count > 0
                  ? `${pendingRefunds.count} refund${pendingRefunds.count === 1 ? '' : 's'} and ${openPayouts.count} payout${openPayouts.count === 1 ? '' : 's'} awaiting your decision.`
                  : 'No items waiting on your decision right now.'}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="primary" size="md" onClick={() => router.push('/finance/refunds')}>
                Review refunds
              </Button>
              <Button variant="subtle" size="md" onClick={() => router.push('/finance/payouts')}>
                Process payouts
              </Button>
            </div>
          </div>
        </Card>

        {/* Today's revenue rollup — one card per currency seen today. */}
        <SectionCard
          title="Today's captured revenue"
          subtitle="Per-currency rollup (only successful payments since midnight)"
          helpText="Finance dashboard never sums across currencies — operators get accurate per-currency totals."
        >
          {loading ? (
            <Spinner />
          ) : errors.payments ? (
            <ErrorBox error={errors.payments} />
          ) : paymentsByCurrency.length === 0 ? (
            <EmptyState
              message="No captured revenue today yet"
              description="Today's payments roll up here as they settle."
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {paymentsByCurrency.map((b) => (
                <button
                  key={b.currency}
                  type="button"
                  onClick={() => router.push(`/finance/payments?currency=${b.currency}`)}
                  className="text-left p-4 rounded-xl bg-[#F7FBF6] ring-1 ring-[#E5F1E2] hover:ring-[#45A735] hover:shadow-[0_4px_12px_rgba(69,167,53,0.10)] transition-all"
                >
                  <div className="text-[11px] uppercase tracking-wider text-[#909090] font-open-sauce-semibold">
                    {b.currency}
                  </div>
                  <div className="text-2xl font-open-sauce-bold text-[#26472B] tabular-nums mt-1">
                    {b.total.toLocaleString()}
                  </div>
                </button>
              ))}
            </div>
          )}
        </SectionCard>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Refunds pending"
            value={pendingRefunds.count.toLocaleString()}
            hint="Awaiting your approval"
            color={pendingRefunds.count > 0 ? 'orange' : 'slate'}
            icon="↩"
            onClick={() => router.push('/finance/refunds')}
          />
          <StatCard
            label="Payouts open"
            value={openPayouts.count.toLocaleString()}
            hint="Cycles to process"
            color={openPayouts.count > 0 ? 'amber' : 'slate'}
            icon="💸"
            onClick={() => router.push('/finance/payouts')}
          />
          <StatCard
            label="Recent payments"
            value={recentPayments.length.toLocaleString()}
            hint="Last 10 captured"
            color="green"
            icon="🧾"
            onClick={() => router.push('/finance/payments')}
          />
          <StatCard
            label="Reconciliation"
            value="Open"
            hint="Diff against gateways"
            color="slate"
            icon="🔍"
            onClick={() => router.push('/finance/reconciliation')}
          />
        </div>

        {/* Side-by-side: pending refunds + open payouts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SectionCard
            title="Refunds pending approval"
            subtitle="Top 5 — click to review"
            action={
              <Button size="sm" variant="subtle" onClick={() => router.push('/finance/refunds')}>
                View all
              </Button>
            }
          >
            {pendingRefunds.items.length === 0 ? (
              <EmptyState message="No refunds awaiting approval" description="Pending refund requests appear here." />
            ) : (
              <div className="divide-y divide-[#EEF5EC] -mx-5">
                {pendingRefunds.items.map((r) => (
                  <button
                    key={r._id}
                    type="button"
                    onClick={() => router.push(`/finance/refunds/${r._id}`)}
                    className="w-full flex items-center justify-between gap-3 px-5 py-3 hover:bg-[#F7FBF6] transition-colors text-left"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-open-sauce-semibold text-[#26472B] truncate">
                        {r.reason || 'Refund request'}
                      </div>
                      <div className="text-xs text-[#636363] truncate">
                        {r.country ? `${r.country} · ` : ''}
                        {new Date(r.createdAt || r.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-open-sauce-bold text-[#26472B] tabular-nums">
                        {fmtMoney(r.amount, r.currency)}
                      </span>
                      <StatusBadge status={r.status} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Open payout cycles"
            subtitle="Top 5"
            action={
              <Button size="sm" variant="subtle" onClick={() => router.push('/finance/payouts')}>
                Process queue
              </Button>
            }
          >
            {openPayouts.items.length === 0 ? (
              <EmptyState message="No open payout cycles" description="Pending payout cycles appear here." />
            ) : (
              <div className="divide-y divide-[#EEF5EC] -mx-5">
                {openPayouts.items.map((p) => (
                  <button
                    key={p._id}
                    type="button"
                    onClick={() => router.push(`/finance/payouts/${p._id}`)}
                    className="w-full flex items-center justify-between gap-3 px-5 py-3 hover:bg-[#F7FBF6] transition-colors text-left"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-open-sauce-semibold text-[#26472B] truncate">
                        {p.cycleLabel || `Cycle ${String(p._id).slice(-6)}`}
                      </div>
                      <div className="text-xs text-[#636363] truncate">
                        {p.country ? `${p.country} · ` : ''}
                        {p.recipientCount ? `${p.recipientCount} recipients · ` : ''}
                        {new Date(p.createdAt || p.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-open-sauce-bold text-[#26472B] tabular-nums">
                        {fmtMoney(p.totalAmount || p.amount, p.currency)}
                      </span>
                      <StatusBadge status={p.status} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Recent payments */}
        <SectionCard
          title="Recent payments"
          subtitle="Last 10 across all gateways"
          action={
            <Button size="sm" variant="subtle" onClick={() => router.push('/finance/payments')}>
              View all
            </Button>
          }
        >
          {loading ? (
            <Spinner />
          ) : recentPayments.length === 0 ? (
            <EmptyState message="No payments yet" description="Payments will populate here as they capture." />
          ) : (
            <div className="divide-y divide-[#EEF5EC] -mx-5">
              {recentPayments.map((p) => (
                <div
                  key={p._id}
                  className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-[#F7FBF6] transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-open-sauce-semibold text-[#26472B] truncate">
                      {p.gateway?.toUpperCase() || 'GATEWAY'} ·{' '}
                      <span className="text-[#636363] font-open-sauce">
                        {String(p.gatewayPaymentId || p._id).slice(0, 16)}…
                      </span>
                    </div>
                    <div className="text-xs text-[#909090] truncate">
                      {p.country ? `${p.country} · ` : ''}
                      {new Date(p.createdAt || p.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <StatusBadge status={p.status} />
                    <span className="text-sm font-open-sauce-bold text-[#26472B] tabular-nums">
                      {fmtMoney(p.amount, p.currency)}
                    </span>
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
