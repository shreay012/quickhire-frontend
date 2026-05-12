'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import staffApi from '@/lib/axios/staffApi';
import { showError, showSuccess } from '@/lib/utils/toast';
import { s } from '@/lib/utils/i18nText';
import {
  PageHeader,
  StatusBadge,
  Spinner,
  ErrorBox,
  Button,
} from '@/components/staff/ui';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleString('en-IN'); } catch { return '—'; }
}

function fmtINR(amount) {
  if (amount == null || isNaN(Number(amount))) return '—';
  return '₹' + Number(amount).toLocaleString('en-IN');
}

function fmtDuration(ms) {
  if (!ms || ms < 0) ms = 0;
  const t = Math.floor(ms / 1000);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '00')}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Field({ label, value, sub, mono, wide }) {
  return (
    <div className={wide ? 'col-span-2 sm:col-span-3' : ''}>
      <div className="text-[11px] uppercase tracking-wider text-[#909090] font-open-sauce-semibold mb-0.5">
        {label}
      </div>
      <div
        className={`text-sm leading-snug ${
          mono
            ? 'font-mono text-[11px] break-all text-[#484848]'
            : 'font-open-sauce-semibold text-[#26472B]'
        }`}
      >
        {value ?? '—'}
      </div>
      {sub && <div className="text-[11px] text-[#909090] mt-0.5">{sub}</div>}
    </div>
  );
}

function Card({ title, subtitle, children, action, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-[#E5F1E2] shadow-[0_1px_3px_rgba(38,71,43,0.04)] ${className}`}>
      {(title || action) && (
        <div className="px-5 pt-4 pb-3 border-b border-[#E5F1E2] flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-open-sauce-bold text-[#26472B]">{title}</div>
            {subtitle && <div className="text-xs text-[#636363] mt-0.5 font-open-sauce">{subtitle}</div>}
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </div>
      )}
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminBookingDetailPage() {
  const { id } = useParams();
  const router  = useRouter();

  const [job, setJob]         = useState(null);
  const [error, setError]     = useState(null);
  const [showReject, setShowReject]     = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState(null); // 'confirm' | 'reject'

  const loadJob = useCallback(async () => {
    setError(null);
    try {
      const r = await staffApi.get(`/admin/bookings/${id}`);
      setJob(r.data?.data || r.data || null);
    } catch (e) {
      setError(e);
    }
  }, [id]);

  useEffect(() => { loadJob(); }, [loadJob]);

  const doConfirm = async () => {
    setBusy('confirm');
    try {
      await staffApi.post(`/admin/bookings/${id}/confirm`);
      showSuccess('Booking confirmed successfully.');
      await loadJob();
    } catch (e) {
      showError(e?.response?.data?.error?.message || e?.message || 'Failed to confirm.');
    } finally {
      setBusy(null);
    }
  };

  const doReject = async () => {
    setBusy('reject');
    try {
      await staffApi.patch(`/admin/bookings/${id}/reject`, { reason: rejectReason.trim() });
      showSuccess('Booking cancelled.');
      setShowReject(false);
      setRejectReason('');
      await loadJob();
    } catch (e) {
      showError(e?.response?.data?.error?.message || e?.message || 'Failed to cancel booking.');
    } finally {
      setBusy(null);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-[#F5F7F5]">
        <PageHeader
          title="Booking Detail"
          subtitle="Failed to load booking"
          backHref="/super-admin/bookings"
        />
        <div className="p-6">
          <ErrorBox error={error} />
          <div className="mt-4">
            <Button variant="subtle" onClick={() => router.push('/super-admin/bookings')}>
              ← Back to Bookings
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-[#F5F7F5]">
        <PageHeader title="Booking Detail" subtitle="Loading…" backHref="/super-admin/bookings" />
        <div className="p-6">
          <Spinner />
        </div>
      </div>
    );
  }

  const svc       = job.services?.[0] || {};
  const bookingId = String(job._id);
  const canCancel = !['cancelled', 'completed'].includes(job.status);

  return (
    <div className="min-h-screen bg-[#F5F7F5]">
      <PageHeader
        title={`Booking #${bookingId.slice(-8)}`}
        subtitle={`${job.customerName || 'Customer'} · ${job.serviceName || 'Service'} · ${job.status?.replace(/_/g, ' ') || 'pending'}`}
        backHref="/super-admin/bookings"
        breadcrumbs={[
          { label: 'Admin',    href: '/admin' },
          { label: 'Bookings', href: '/super-admin/bookings' },
          { label: `#${bookingId.slice(-8)}` },
        ]}
        helpText="Review booking details and confirm or cancel. Assignment is handled by the country admin."
        action={
          <Button variant="subtle" size="sm" onClick={() => router.push('/super-admin/bookings')}>
            ← All Bookings
          </Button>
        }
      />

      <div className="p-4 sm:p-8 grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ══════════════════════ LEFT (col-span-2) ══════════════════════ */}
        <div className="lg:col-span-2 space-y-5">

          {/* ── Booking Summary Card ─────────────────────────────────────── */}
          <Card
            title={
              <span className="flex items-center gap-2">
                Booking #{bookingId.slice(-8)}
                <StatusBadge status={job.status} size="lg" />
              </span>
            }
            subtitle={`Created ${fmtDate(job.createdAt)}`}
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
              <Field label="Customer"  value={s(job.customerName) || '—'} sub={job.customerMobile} />
              <Field label="Service"   value={s(job.serviceName) || s(svc.name) || '—'} />
              <Field label="Country"   value={job.country || '—'} />
              <Field label="Amount"    value={fmtINR(job.amount)} />
              <Field label="Duration"  value={svc.durationTime ? `${svc.durationTime} h` : '—'} />
              <Field label="Start Time" value={svc.startTime || fmtDate(job.startTime) || '—'} />
              <Field label="Start Date" value={svc.preferredStartDate ? new Date(svc.preferredStartDate).toLocaleDateString('en-IN') : '—'} />
              <Field label="Time Worked" value={fmtDuration(job.workedMs || 0)} mono />
              <Field label="Started At"   value={fmtDate(job.startedAt)} />
              <Field label="Completed At" value={fmtDate(job.completedAt)} />
              <Field label="Resource" value={s(job.resourceName) || s(job.assignedResource?.name) || '—'} />
              <Field label="PM"       value={s(job.pmName) || s(job.projectManager?.name) || '—'} />
              <Field label="Booking ID" value={bookingId} mono wide />
            </div>

            {(svc.requirements || job.requirements) && (
              <div className="mt-5 pt-4 border-t border-[#E5F1E2]">
                <div className="text-[11px] uppercase tracking-wider text-[#909090] font-open-sauce-semibold mb-2">
                  Requirements
                </div>
                <textarea
                  readOnly
                  value={svc.requirements || job.requirements}
                  rows={3}
                  className="w-full border border-[#E5F1E2] rounded-xl px-3 py-2.5 text-sm text-[#484848] bg-[#F7FBF6] resize-none font-open-sauce focus:outline-none"
                />
              </div>
            )}

            <div className="flex gap-2 flex-wrap mt-5 pt-4 border-t border-[#E5F1E2]">
              {job.status === 'pending' && (
                <Button
                  variant="primary"
                  onClick={doConfirm}
                  disabled={!!busy}
                  loading={busy === 'confirm'}
                >
                  ✓ Confirm Booking
                </Button>
              )}
              {canCancel && !showReject && (
                <Button
                  variant="danger"
                  onClick={() => { setShowReject(true); setRejectReason(''); }}
                  disabled={!!busy}
                >
                  ✗ Cancel Booking
                </Button>
              )}
            </div>

            {showReject && (
              <div className="mt-3 border border-red-200 rounded-xl p-4 bg-red-50">
                <p className="text-xs font-open-sauce-semibold text-red-700 mb-2">
                  Reason for cancellation:
                </p>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Enter reason (optional)…"
                  rows={2}
                  className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm font-open-sauce text-[#484848] bg-white resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
                />
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={doReject}
                    disabled={busy === 'reject'}
                    loading={busy === 'reject'}
                  >
                    Confirm Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setShowReject(false); setRejectReason(''); }}
                    disabled={busy === 'reject'}
                  >
                    Nevermind
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* ── Activity Timeline Card ────────────────────────────────────── */}
          {job.history && job.history.length > 0 ? (
            <Card
              title="Activity Timeline"
              subtitle={`${job.history.length} event${job.history.length !== 1 ? 's' : ''} recorded`}
            >
              <div className="relative">
                <div className="absolute left-[7px] top-0 bottom-0 w-px bg-[#E5F1E2]" />
                <div className="space-y-4 pl-6">
                  {[...job.history].reverse().map((h, i) => (
                    <div key={i} className="relative">
                      <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-[#45A735] border-2 border-white shadow-sm flex-shrink-0" />
                      <div className="bg-[#F7FBF6] rounded-xl border border-[#E5F1E2] px-4 py-3">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-open-sauce-semibold text-[#26472B]">
                              {h.event}
                            </span>
                            {h.actorRole && (
                              <span className="text-[10px] bg-[#E5F1E2] text-[#26472B] rounded-full px-2 py-0.5 font-open-sauce-semibold uppercase tracking-wider">
                                {h.actorRole}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-[#909090] font-open-sauce flex-shrink-0">
                            {fmtDate(h.at || h.timestamp || h.createdAt)}
                          </span>
                        </div>
                        {h.note && (
                          <p className="text-xs text-[#636363] font-open-sauce mt-1 leading-relaxed">
                            {h.note}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ) : (
            <Card title="Activity Timeline" subtitle="No events recorded yet">
              <div className="py-4 text-center text-sm text-[#909090] font-open-sauce italic">
                Activity will appear here as the booking progresses.
              </div>
            </Card>
          )}
        </div>

        {/* ══════════════════════ RIGHT (col-span-1) ═════════════════════ */}
        <div className="lg:col-span-1 flex flex-col gap-5">

          {/* ── Quick Status Overview ─────────────────────────────────────── */}
          <Card title="Booking Status">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#909090] font-open-sauce-semibold uppercase tracking-wider">
                  Current Status
                </span>
                <StatusBadge status={job.status} size="lg" />
              </div>
              <div className="h-px bg-[#E5F1E2]" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#909090] font-open-sauce-semibold uppercase tracking-wider">
                  Country
                </span>
                <span className="text-sm font-open-sauce-semibold text-[#26472B]">
                  {job.country || '—'}
                </span>
              </div>
              <div className="h-px bg-[#E5F1E2]" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#909090] font-open-sauce-semibold uppercase tracking-wider">
                  Booking ID
                </span>
                <code className="text-xs font-mono text-[#484848] bg-[#F2F9F1] px-2 py-1 rounded-lg">
                  #{bookingId.slice(-8)}
                </code>
              </div>
              {job.amount != null && (
                <>
                  <div className="h-px bg-[#E5F1E2]" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#909090] font-open-sauce-semibold uppercase tracking-wider">
                      Amount
                    </span>
                    <span className="text-sm font-open-sauce-bold text-[#26472B]">
                      {fmtINR(job.amount)}
                    </span>
                  </div>
                </>
              )}
              {svc.durationTime && (
                <>
                  <div className="h-px bg-[#E5F1E2]" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#909090] font-open-sauce-semibold uppercase tracking-wider">
                      Duration
                    </span>
                    <span className="text-sm font-open-sauce-semibold text-[#26472B]">
                      {svc.durationTime} h
                    </span>
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* ── Country Admin Note ────────────────────────────────────────── */}
          <Card title="Assignment">
            <div className="text-sm text-[#636363] font-open-sauce leading-relaxed">
              PM and resource assignment is handled by the country admin for{' '}
              <span className="font-open-sauce-semibold text-[#26472B]">
                {job.country || 'this region'}
              </span>
              . They will be notified automatically when this booking is confirmed.
            </div>
          </Card>

        </div>
      </div>
    </div>
  );
}
