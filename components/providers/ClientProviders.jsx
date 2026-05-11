'use client';

import { Toaster } from 'react-hot-toast';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LegalAcceptanceProvider } from './LegalAcceptanceProvider';
import { SocketProvider } from './SocketProvider';
// Phase B (2026-05-11): catch 403 PROFILE_INCOMPLETE from any API call and
// pop an inline completion form. Single mount at root works for every
// page including the staff portals (StaffShell renders inside this tree).
import ProfileGate from '@/components/common/ProfileGate';
// Client-only cleaner for browser-extension attribute pollution
// (Bitdefender Anti-Tracker etc.). Replaces the prior inline <script>
// in <head> which the extension was actively rewriting → caused a
// fresh hydration mismatch. Run-after-hydration sidesteps that.
import ExtensionAttrsCleaner from '@/components/common/ExtensionAttrsCleaner';
// Bug_49 fix (2026-05-11): JWT-expiry watcher. Decodes exp from the
// access token in localStorage and schedules an auto-logout + redirect
// when it lapses, so silent 401s never accumulate during a session.
import SessionTimeoutWatcher from '@/components/common/SessionTimeoutWatcher';

/**
 * Client-only providers wrapper.
 * Keeps layout.jsx (server component) free of client imports.
 *
 * Provider order (outer-most first):
 *   ErrorBoundary → SocketProvider → LegalAcceptanceProvider
 *
 * <Toaster /> is the single global toast surface (react-hot-toast).
 * SocketProvider lives at the root so realtime notifications + sound work
 * across every page (customer, /admin, /pm, /resource, /staff-login).
 */
export default function ClientProviders({ children }) {
  return (
    <ErrorBoundary>
      <SocketProvider>
        <LegalAcceptanceProvider>
          {children}
        </LegalAcceptanceProvider>
      </SocketProvider>
      {/* ProfileGate listens for the qh:profile-incomplete window event
          emitted by both axios interceptors. Renders nothing until then. */}
      <ProfileGate />
      {/* Strip Bitdefender/browser-extension attrs after hydration.
          Renders nothing — pure useEffect side-effect. */}
      <ExtensionAttrsCleaner />
      {/* Decode JWT exp + auto-logout when the access token lapses.
          Listens for `qh:session-armed` (dispatched on successful login)
          to re-arm on session change. Renders nothing. */}
      <SessionTimeoutWatcher />
      <Toaster
        position="top-right"
        gutter={10}
        containerStyle={{ zIndex: 9999 }}
        toastOptions={{
          duration: 5000,
          style: { fontFamily: 'inherit', borderRadius: '12px', fontSize: '14px' },
          success: { iconTheme: { primary: '#45A735', secondary: '#fff' } },
        }}
      />
    </ErrorBoundary>
  );
}
