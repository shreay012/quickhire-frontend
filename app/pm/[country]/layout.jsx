'use client';
import { use } from 'react';
import StaffShell from '@/components/staff/StaffShell';

const FLAGS = { IN: '🇮🇳', AE: '🇦🇪', DE: '🇩🇪', AU: '🇦🇺', US: '🇺🇸' };

function buildLinks(country) {
  const c = country.toUpperCase();
  const flag = FLAGS[c] || '🌐';
  const base = `/pm/${country}`;
  return [
    { type: 'section', label: `${flag} ${c} Workspace` },
    { href: base, label: 'Dashboard', icon: <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
    { href: `${base}/bookings`, label: 'My Bookings', icon: <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><path d="M9 5a2 2 0 002 2h2a2 2 0 002-2"/></svg> },
  ];
}

export default function PmCountryLayout({ children, params }) {
  // Next.js 16: params is a Promise — unwrap once with React.use().
  const segment = use(params)?.country || 'in';
  return (
    <StaffShell
      role="pm"
      allowedRoles={['pm']}
      homeHref={`/pm/${segment}`}
      links={buildLinks(segment)}
    >
      {children}
    </StaffShell>
  );
}
