'use client';

/**
 * /admin layout — REDIRECT-ONLY shell.
 *
 * The bare `/admin` URL space has no business showing operational content
 * to anyone. Every staff role has a dedicated portal:
 *   • super_admin → /super-admin
 *   • country admin → /admin/{country}  (the [country] sub-layout)
 *   • pm           → /pm/{country}
 *   • resource     → /resource/{country}
 *   • seo          → /seo-admin
 *   • finance      → /finance
 *
 * This layout used to render a heavy 389-line global nav (Geo Pricing,
 * Blog Categories, Audit Log, Fraud Monitor, etc.) which inadvertently
 * exposed cross-country surfaces + super_admin-only tools to country
 * admins for a few hundred milliseconds before the redirect fired.
 * Phase-fix (2026-05-11): replace with a tiny redirect-only stub.
 *
 * The child pages under /admin/<page>.jsx (e.g. /admin/bookings,
 * /admin/services) still exist and remain reachable to super_admin via
 * the /super-admin shell — they're shared component code, not duplicated.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { staffAuth } from '@/lib/axios/staffApi';

export default function AdminLayout({ children }) {
  const router = useRouter();

  useEffect(() => {
    const user = staffAuth.getUser();

    if (!user) {
      router.replace('/staff-login');
      return;
    }
    if (user.role === 'super_admin') {
      router.replace('/super-admin');
      return;
    }
    if (user.role === 'admin' && user.country) {
      router.replace(`/admin/${user.country.toLowerCase()}`);
      return;
    }
    // Admin without a country → misconfigured profile. Bounce to login so
    // they can be re-issued a proper session. This also catches the
    // edge case of an orphan account.
    if (user.role === 'admin' && !user.country) {
      router.replace('/staff-login?reason=missing_country');
      return;
    }
    // Other roles (pm/resource/seo/finance/etc.) → their own portal.
    const ROLE_HOME = {
      pm:       user.country ? `/pm/${user.country.toLowerCase()}` : '/staff-login',
      resource: user.country ? `/resource/${user.country.toLowerCase()}` : '/staff-login',
      seo:      '/seo-admin',
      finance:  '/finance',
    };
    router.replace(ROLE_HOME[user.role] || '/staff-login');
  }, [router]);

  // Once useEffect runs we'll already be navigating away; render a tiny
  // neutral loading state instead of the old heavy nav.
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F7F5]">
      <div className="flex items-center gap-3 text-[#26472B] text-sm font-open-sauce-semibold">
        <span className="w-4 h-4 rounded-full border-2 border-[#45A735] border-t-transparent animate-spin" />
        Redirecting to your workspace…
      </div>
      {/* Render the child (page.jsx) so Next.js doesn't tear-down mid-redirect;
          it's invisible behind the absolute-positioned loading state above. */}
      <div className="hidden">{children}</div>
    </div>
  );
}
