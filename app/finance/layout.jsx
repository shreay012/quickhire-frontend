'use client';
/**
 * Finance Portal Layout
 *
 * Per `Updated docs/12-restrictions-and-permissions-matrix.md`, the
 * finance role has these reads/writes only:
 *   ✅ payments, refunds, payouts, reconciliation, fraud feed
 *   ✅ promos read, FX-rate refresh
 *   ❌ bookings write, services edit, CMS, SEO, blog, RBAC, KYC,
 *      chat takeover, audit log, tickets
 *
 * Nav surface here is intentionally minimal — only what finance needs.
 * Country-scoped finance users (with `req.user.country`) see their own
 * country's data only; global finance sees everything (server-side
 * scoping is authoritative — this UI just hides cross-country links).
 */
import StaffShell from '@/components/staff/StaffShell';

const links = [
  { type: 'section', label: 'Overview' },
  {
    href: '/finance',
    label: 'Dashboard',
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  { type: 'section', label: 'Money' },
  {
    href: '/finance/payments',
    label: 'Payments',
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <rect x={1} y={4} width={22} height={16} rx={2} ry={2} />
        <line x1={1} y1={10} x2={23} y2={10} />
      </svg>
    ),
  },
  {
    href: '/finance/refunds',
    label: 'Refunds',
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12a9 9 0 109-9" />
        <path d="M3 4v8h8" />
      </svg>
    ),
  },
  {
    href: '/finance/payouts',
    label: 'Payouts',
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1v22" />
        <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
      </svg>
    ),
  },
  {
    href: '/finance/reconciliation',
    label: 'Reconciliation',
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
];

export default function FinanceLayout({ children }) {
  return (
    <StaffShell
      role="finance"
      // Allow super_admin to view via finance lens for debugging — they
      // have all perms in the backend regardless of UI nav.
      allowedRoles={['finance', 'super_admin']}
      homeHref="/finance"
      links={links}
    >
      {children}
    </StaffShell>
  );
}
