'use client';

import { usePathname } from 'next/navigation';
import { Header, Footer } from './';

// Strip a `/in|/ae|/de|/us|/au` country prefix so route-matching below works
// the same whether the URL is /admin or /de/admin (next.config.js rewrites
// the latter to the former at the server, but pathname in the browser still
// reads as /de/admin and would otherwise leak the customer Header/Footer
// into staff portals).
const COUNTRY_PREFIX_RE = /^\/(?:in|ae|de|us|au)(?=\/|$)/i;
function normalizePath(p) {
  if (!p) return p;
  return p.replace(COUNTRY_PREFIX_RE, '') || '/';
}

export default function LayoutWrapper({ children }) {
  const pathname = normalizePath(usePathname());

  // Don't show header/footer on login page
  if (pathname === '/login') {
    return <>{children}</>;
  }

  // Staff portals use their own StaffShell layout — no customer header/footer.
  if (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/super-admin') ||
    pathname.startsWith('/seo-admin') ||
    pathname.startsWith('/finance') ||
    pathname.startsWith('/pm') ||
    pathname.startsWith('/resource') ||
    pathname.startsWith('/staff-login')
  ) {
    return <>{children}</>;
  }

  // Don't show footer on routes where it competes with workflow chrome.
  // Bug_87 fix (2026-05-11): added /book-your-resource and /checkout
  // because the booking wizard is full-page and the footer was peeking
  // out at the bottom of long scroll states.
  const showFooter =
    !pathname.startsWith('/service-details') &&
    !pathname.startsWith('/booking-workspace') &&
    !pathname.startsWith('/booking-ongoing') &&
    !pathname.startsWith('/book-your-resource') &&
    !pathname.startsWith('/checkout') &&
    !pathname.startsWith('/support-chat');
    // Bug_55: /cart KEEPS the footer (was missing before; now restored
    // by removing it from this exclusion list).

  return (
    <>
      <Header />
      {children}
      {showFooter && <Footer />}
    </>
  );
}
