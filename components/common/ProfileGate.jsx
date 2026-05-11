'use client';

/**
 * ProfileGate — Phase B (2026-05-11) gentle profile-completion prompt.
 *
 * Mounted once near the root of every layout (customer + staff). Listens
 * for the `qh:profile-incomplete` window event emitted by the axios
 * interceptors when a 403 PROFILE_INCOMPLETE comes back. Pops a small
 * modal asking for email + E.164 mobile, posts to `PUT /api/user/profile`,
 * then refreshes the access token so subsequent calls have email+mobile
 * baked into the JWT claims.
 *
 * Design choices:
 *   • Re-uses both axios clients (customer + staff) so it works regardless
 *     of which one triggered the event. The component figures out which
 *     instance to call by checking for a staff session token in storage.
 *   • Modal is non-dismissible: profile must be completed before the user
 *     can keep working. (They can always sign out as a last resort.)
 *   • E.164 validation is lenient — we accept any +CC followed by 8-15
 *     digits, matching the backend `isE164()` helper.
 *
 * Backend: PUT /api/user/profile  body { email, mobile, ...optional }
 *          → re-issues a JWT with email+mobile claims.
 */

import { useEffect, useState, useCallback } from 'react';
import axiosInstance from '@/lib/axios/axiosInstance';
import staffApi, { staffAuth } from '@/lib/axios/staffApi';

const COUNTRY_DIAL_CODES = [
  { code: '+91',  label: '🇮🇳 +91',  iso: 'IN' },
  { code: '+971', label: '🇦🇪 +971', iso: 'AE' },
  { code: '+49',  label: '🇩🇪 +49',  iso: 'DE' },
  { code: '+1',   label: '🇺🇸 +1',   iso: 'US' },
  { code: '+61',  label: '🇦🇺 +61',  iso: 'AU' },
];

// Backend isE164 spec: must start with `+`, total length 8-16, only digits after `+`.
function isValidE164(mobile) {
  return /^\+[1-9]\d{7,14}$/.test(mobile);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function ProfileGate() {
  const [open, setOpen] = useState(false);
  const [missing, setMissing] = useState({ email: false, mobile: false });
  const [dial, setDial] = useState('+91');
  const [mobileLocal, setMobileLocal] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Whether the caller was on the staff portal (use staffApi); fall back
  // to customer axiosInstance otherwise.
  const isStaff = useCallback(() => {
    try {
      return !!staffAuth.getToken();
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onIncomplete = (e) => {
      const m = e?.detail?.missing || { email: true, mobile: true };
      queueMicrotask(() => {
        setMissing(m);
        setErr('');
        setOpen(true);
      });
    };
    window.addEventListener('qh:profile-incomplete', onIncomplete);
    return () => window.removeEventListener('qh:profile-incomplete', onIncomplete);
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');

    const fullMobile = `${dial}${mobileLocal.replace(/\D/g, '')}`;
    if (missing.email && !isValidEmail(email)) {
      setErr('Enter a valid email address.');
      return;
    }
    if (missing.mobile && !isValidE164(fullMobile)) {
      setErr('Enter a valid mobile number (8-15 digits after country code).');
      return;
    }

    setBusy(true);
    try {
      const body = {};
      if (missing.email) body.email = email;
      if (missing.mobile) body.mobile = fullMobile;
      const api = isStaff() ? staffApi : axiosInstance;
      const res = await api.put('/user/profile', body);

      // The PUT /user/profile endpoint re-issues an access token with the
      // new email/mobile claims so subsequent requests pass the middleware.
      // If the backend doesn't include a token, we still close the modal —
      // the next request that fires will succeed because the DB row is now
      // valid and the middleware checks the DB (or, in the near future,
      // re-issues on next OTP).
      const newToken = res?.data?.data?.token || res?.data?.token;
      if (newToken && typeof window !== 'undefined') {
        if (isStaff()) {
          const user = { ...(staffAuth.getUser() || {}), email: body.email || undefined, mobile: body.mobile || undefined };
          staffAuth.setSession({ token: newToken, user });
        } else {
          window.localStorage.setItem('token', newToken);
        }
      }
      setOpen(false);
      // Soft reload so the new JWT propagates everywhere in the app.
      if (typeof window !== 'undefined') window.location.reload();
    } catch (e2) {
      setErr(e2?.response?.data?.error?.message || 'Could not save. Please try again.');
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-gate-title"
      >
        <div>
          <h2 id="profile-gate-title" className="text-xl font-open-sauce-bold text-[#26472B]">
            Complete your profile
          </h2>
          <p className="text-sm text-[#636363] mt-2 leading-relaxed">
            We need your email and mobile number with a country code so we can send booking
            confirmations, OTPs, and important account updates. This only takes a moment.
          </p>
        </div>

        {missing.email ? (
          <div>
            <label className="block text-xs font-open-sauce-semibold text-[#26472B] mb-1.5">
              Email address
            </label>
            <input
              type="email"
              required
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#D6EBCF] focus:outline-none focus:ring-2 focus:ring-[#45A735]/30 focus:border-[#45A735] text-sm font-open-sauce text-[#242424]"
            />
          </div>
        ) : null}

        {missing.mobile ? (
          <div>
            <label className="block text-xs font-open-sauce-semibold text-[#26472B] mb-1.5">
              Mobile number
            </label>
            <div className="flex gap-2">
              <select
                value={dial}
                onChange={(e) => setDial(e.target.value)}
                className="px-3 py-2.5 rounded-lg border border-[#D6EBCF] focus:outline-none focus:ring-2 focus:ring-[#45A735]/30 focus:border-[#45A735] text-sm font-open-sauce-semibold text-[#26472B] bg-white"
              >
                {COUNTRY_DIAL_CODES.map((c) => (
                  <option key={c.iso} value={c.code}>{c.label}</option>
                ))}
              </select>
              <input
                type="tel"
                required
                placeholder="10-digit mobile"
                value={mobileLocal}
                onChange={(e) => setMobileLocal(e.target.value.replace(/\D/g, '').slice(0, 15))}
                className="flex-1 px-3.5 py-2.5 rounded-lg border border-[#D6EBCF] focus:outline-none focus:ring-2 focus:ring-[#45A735]/30 focus:border-[#45A735] text-sm font-open-sauce text-[#242424]"
              />
            </div>
            <p className="text-[11px] text-[#909090] mt-1.5">
              We&rsquo;ll send your verification code to this number.
            </p>
          </div>
        ) : null}

        {err ? (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
            {err}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="w-full py-2.5 bg-[#45A735] hover:bg-[#26472B] text-white rounded-lg text-sm font-open-sauce-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_4px_14px_rgba(120,235,84,0.30)]"
        >
          {busy ? 'Saving…' : 'Save and continue'}
        </button>

        <div className="text-center text-[11px] text-[#909090] font-open-sauce">
          You can update these later from your profile settings.
        </div>
      </form>
    </div>
  );
}
