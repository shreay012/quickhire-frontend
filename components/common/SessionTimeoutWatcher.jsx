'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

/**
 * Bug_49 fix (2026-05-11):
 *
 * Before this component existed, an access token could lapse silently
 * mid-session — every subsequent API call returned 401 and the UI kept
 * rendering the authenticated shell as if nothing had happened. The
 * customer's only signal was empty data + "Something went wrong"
 * toasts.
 *
 * This watcher:
 *   1. Decodes the JWT exp claim out of `localStorage.token`.
 *   2. Schedules a one-shot timer for `(exp - now) ms`.
 *   3. When the timer fires (or on the `qh:session-armed` event from a
 *      fresh login), it wipes the token, dispatches `qh:session-expired`
 *      so other tabs can react via the `storage` event, and replaces
 *      the URL with `/login?reason=session-timeout&next=<current path>`.
 *   4. Cross-tab logout: a `storage` event for `token` being removed in
 *      another tab triggers the same redirect here.
 *
 * Renders nothing — pure side-effect mount in ClientProviders.
 *
 * The 5-second grace at the start lets us absorb the clock skew between
 * the user's machine and our JWT issuer (we've seen up to 3s on lab
 * Wi-Fi). Falling under 5s would risk a flap where the watcher logs the
 * user out a hair before the token actually expires, then a refresh on
 * page reload immediately re-authenticates them — confusing.
 */
const SKEW_GRACE_MS = 5_000;

function decodeJwtExpMs(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    // base64url → base64
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const json = typeof atob === 'function'
      ? atob(padded)
      : Buffer.from(padded, 'base64').toString('utf-8');
    const payload = JSON.parse(json);
    if (typeof payload.exp !== 'number') return null;
    return payload.exp * 1000;
  } catch {
    return null;
  }
}

export default function SessionTimeoutWatcher() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let timeoutId = null;

    const expire = (reason = 'session-timeout') => {
      try {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      } catch { /* private mode */ }
      window.dispatchEvent(new CustomEvent('qh:session-expired', { detail: { reason } }));
      // Already on /login? Don't loop.
      if (pathname && !pathname.startsWith('/login') && !pathname.startsWith('/staff-login')) {
        const next = encodeURIComponent(pathname || '/');
        router.replace(`/login?reason=${reason}&next=${next}`);
      }
    };

    const arm = () => {
      if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
      const token = localStorage.getItem('token');
      if (!token) return;
      const expMs = decodeJwtExpMs(token);
      if (!expMs) return;
      const delta = expMs - Date.now() + SKEW_GRACE_MS;
      if (delta <= 0) { expire('session-timeout'); return; }
      // Cap at 24h so a malformed exp far in the future doesn't pin a
      // setTimeout for days (which Node/browser will clamp to int32 but
      // still keep alive).
      timeoutId = setTimeout(() => expire('session-timeout'), Math.min(delta, 24 * 60 * 60 * 1000));
    };

    const onArmEvent = () => arm();
    const onStorage = (e) => {
      // Cross-tab logout: another tab removed the token → reflect it here.
      if (e.key === 'token' && !e.newValue) expire('session-timeout');
      // Cross-tab login: another tab logged in → re-arm with new exp.
      if (e.key === 'token' && e.newValue) arm();
    };

    arm();
    window.addEventListener('qh:session-armed', onArmEvent);
    window.addEventListener('storage', onStorage);
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener('qh:session-armed', onArmEvent);
      window.removeEventListener('storage', onStorage);
    };
  }, [router, pathname]);

  return null;
}
