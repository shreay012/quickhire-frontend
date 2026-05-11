'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import staffApi, { staffAuth } from '@/lib/axios/staffApi';

// Dev-mode quick-access mobiles. Match the seeded staff users in
// `Backend/backend/src/scripts/seed-staff-and-mock-data.js`.
// Format: { dial: '+91', local: '...' } — the dial code + local digits
// concatenate to the full E.164 mobile sent to the backend.
const ROLES = [
  { id: 'super_admin', label: 'Super Admin',     dial: '+91',  local: '9000000001' },
  { id: 'admin',       label: 'Country Admin',   dial: '+91',  local: '9000000010' },
  { id: 'pm',          label: 'Project Manager', dial: '+91',  local: '9000000020' },
  { id: 'resource',    label: 'Resource',        dial: '+91',  local: '9000000030' },
  { id: 'seo',         label: 'SEO',             dial: '+91',  local: '9000000040' },
  { id: 'finance',     label: 'Finance',         dial: '+91',  local: '9000000050' },
];

// Phase fix (2026-05-11): supported country dial codes — used to populate
// the dropdown next to the mobile field. Previously this form hardcoded
// `+91`, so AE/DE/US/AU country admins couldn't log in at all (their
// mobile after slicing 10 digits ended up matching no row).
const DIAL_CODES = [
  { code: '+91',  label: '🇮🇳 +91',  iso: 'IN' },
  { code: '+971', label: '🇦🇪 +971', iso: 'AE' },
  { code: '+49',  label: '🇩🇪 +49',  iso: 'DE' },
  { code: '+1',   label: '🇺🇸 +1',   iso: 'US' },
  { code: '+61',  label: '🇦🇺 +61',  iso: 'AU' },
];

function getRoleHome(role, country) {
  const c = (country || 'in').toLowerCase();
  if (role === 'super_admin') return '/super-admin';
  if (role === 'admin')       return `/admin/${c}`;
  if (role === 'pm')          return `/pm/${c}`;
  if (role === 'resource')    return `/resource/${c}`;
  if (role === 'seo')         return '/seo-admin';
  if (role === 'finance')     return '/finance';
  return '/';
}

function StaffLoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [role, setRole] = useState('super_admin');
  // Dial code + local digits stored separately so the UI mirrors the
  // staff-profile editor. The full E.164 mobile is `${dial}${local}`.
  const [dial, setDial] = useState('+91');
  const [local, setLocal] = useState('9000000001');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('mobile');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const fullMobile = `${dial}${local}`;

  useEffect(() => {
    const r = params?.get('role');
    if (r && ROLES.some((x) => x.id === r)) {
      setRole(r);
      const m = ROLES.find((x) => x.id === r);
      if (m) { setDial(m.dial); setLocal(m.local); }
    }
  }, [params]);

  const switchRole = (id) => {
    setRole(id);
    setStep('mobile');
    setOtp('');
    setError('');
    setInfo('');
    const m = ROLES.find((x) => x.id === id);
    if (m) { setDial(m.dial); setLocal(m.local); }
  };

  const sendOtp = async (e) => {
    e?.preventDefault();
    setError(''); setInfo(''); setBusy(true);
    try {
      await staffApi.post('/auth/send-otp', { mobile: fullMobile, role });
      setStep('otp');
      // Bug_03/07/17 fix: only hint the master OTP in non-production environments.
      if (process.env.NODE_ENV !== 'production') {
        setInfo('OTP sent. Use 1234 (dev master OTP) or check backend log.');
      } else {
        setInfo('OTP sent. Please check your phone.');
      }
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Failed to send OTP');
    } finally { setBusy(false); }
  };

  const verifyOtp = async (e, otpOverride) => {
    if (e?.preventDefault) e.preventDefault();
    const otpToVerify = otpOverride ?? otp;
    setError(''); setBusy(true);
    try {
      const res = await staffApi.post('/auth/verify-otp', { mobile: fullMobile, otp: otpToVerify, role });
      const data = res.data?.data || {};
      const token = data.token;
      const user = data.user || { mobile: fullMobile, role };
      if (!token) throw new Error('No token in response');
      user.role = role;
      staffAuth.setSession({ token, user });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('staffLoggedIn'));
      }
      router.replace(getRoleHome(user.role || role, user.country));
    } catch (err) {
      setError(err?.response?.data?.error?.message || err.message || 'Login failed');
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#F5F7F5] font-open-sauce text-[#484848]">
      {/* Brand panel */}
      <div className="lg:w-1/2 relative bg-gradient-to-br from-[#26472B] via-[#2E5A33] to-[#45A735] text-white px-8 py-10 lg:py-16 lg:px-16 flex flex-col justify-between overflow-hidden">
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-[#78EB54]/15 blur-3xl" />
        <div className="absolute -bottom-24 -left-16 w-96 h-96 rounded-full bg-[#45A735]/30 blur-3xl" />

        <Link href="/" className="relative inline-flex items-center gap-2.5 w-fit">
          <Image src="/quickhire-logo.svg" alt="QuickHire" width={40} height={40} className="brightness-0 invert" />
          <span className="text-xl font-open-sauce-bold">QuickHire</span>
        </Link>

        <div className="relative max-w-md mt-10 lg:mt-0">
          <div className="inline-block px-3 py-1 rounded-full text-[11px] font-open-sauce-semibold bg-white/15 backdrop-blur ring-1 ring-white/20 uppercase tracking-wider mb-4">
            Staff Portal
          </div>
          <h1 className="text-3xl lg:text-4xl font-open-sauce-bold leading-tight mb-3">
            Manage bookings, teams &amp; resources in one place.
          </h1>
          <p className="text-white/80 text-sm lg:text-base">
            Sign in to your QuickHire workspace as Admin, Project Manager, or Resource.
          </p>
          <ul className="mt-6 space-y-2.5 text-sm">
            {[
              'Realtime booking workflow',
              'Assign PMs &amp; track progress',
              'Log hours and manage assignments',
            ].map((t) => (
              <li key={t} className="flex items-center gap-2.5 text-white/90">
                <span className="w-5 h-5 rounded-full bg-white/15 flex items-center justify-center">
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                    <path d="M5 12l5 5L20 7" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span dangerouslySetInnerHTML={{ __html: t }} />
              </li>
            ))}
          </ul>
        </div>

        <div className="relative text-xs text-white/70">© {new Date().getFullYear()} QuickHire</div>
      </div>

      {/* Form panel */}
      <div className="lg:w-1/2 flex items-center justify-center px-4 py-10 lg:py-16">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-[0_10px_40px_rgba(38,71,43,0.08)] border border-[#E5F1E2] p-7 sm:p-9">
          <div className="text-center mb-7">
            <h2 className="text-2xl font-open-sauce-bold text-[#26472B]">Sign in</h2>
            <p className="text-sm text-[#636363] mt-1">Choose your role to continue</p>
          </div>

          {/* Role tabs — 2 rows × 3 to fit 6 roles cleanly */}
          <div className="grid grid-cols-3 gap-2 mb-6 p-1 bg-[#F2F9F1] rounded-xl">
            {ROLES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => switchRole(r.id)}
                className={`py-2 rounded-lg text-[11px] sm:text-xs font-open-sauce-semibold transition-all duration-200 cursor-pointer ${
                  role === r.id
                    ? 'bg-white text-[#26472B] shadow-sm ring-1 ring-[#D6EBCF]'
                    : 'text-[#636363] hover:text-[#26472B]'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {step === 'mobile' && (
            <form onSubmit={sendOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-open-sauce-semibold text-[#26472B] mb-1.5">
                  Mobile number
                </label>
                <div className="flex items-stretch rounded-lg border border-[#D6EBCF] overflow-hidden focus-within:ring-2 focus-within:ring-[#45A735]/40 focus-within:border-[#45A735] transition">
                  {/* Phase fix (2026-05-11): country-code dropdown so AE / DE / US / AU
                      admins can log in. Was hardcoded `+91` before → non-IN
                      admins were silently locked out. */}
                  <select
                    value={dial}
                    onChange={(e) => setDial(e.target.value)}
                    className="px-2 bg-[#F2F9F1] text-[#26472B] text-sm font-open-sauce-medium border-r border-[#D6EBCF] focus:outline-none cursor-pointer"
                    aria-label="Country dial code"
                  >
                    {DIAL_CODES.map((c) => (
                      <option key={c.iso} value={c.code}>{c.label}</option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    value={local}
                    onChange={(e) => setLocal(e.target.value.replace(/\D/g, '').slice(0, 15))}
                    placeholder="Mobile (digits after country code)"
                    className="flex-1 px-3 py-2.5 text-sm focus:outline-none font-open-sauce text-[#242424]"
                    required
                  />
                </div>
                <p className="mt-1 text-[10px] text-[#909090] font-open-sauce">
                  Will be sent as <code className="font-mono">{fullMobile}</code>
                </p>
              </div>
              <button
                type="submit"
                disabled={busy || local.length < 7}
                className="w-full py-2.5 bg-[#45A735] text-white rounded-lg text-sm font-open-sauce-semibold hover:bg-[#26472B] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_14px_rgba(120,235,84,0.35)] cursor-pointer"
              >
                {busy ? 'Sending…' : 'Send OTP'}
              </button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={verifyOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-open-sauce-semibold text-[#26472B] mb-1.5">
                  OTP sent to {fullMobile}
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => {
                    const entered = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setOtp(entered);
                    // Bug_03/07/17 fix: master OTP auto-submit only in dev/staging.
                    // In production the user must type the real OTP received via SMS.
                    if (process.env.NODE_ENV !== 'production' && entered.length >= 4 && !busy) {
                      verifyOtp(null, entered);
                    }
                  }}
                  placeholder="Enter 4-6 digit OTP"
                  className="w-full px-4 py-3 border border-[#D6EBCF] rounded-lg text-center text-lg tracking-[0.4em] focus:ring-2 focus:ring-[#45A735]/40 focus:border-[#45A735] focus:outline-none font-open-sauce-semibold text-[#242424]"
                  required
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={busy || otp.length < 4}
                className="w-full py-2.5 bg-[#45A735] text-white rounded-lg text-sm font-open-sauce-semibold hover:bg-[#26472B] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_14px_rgba(120,235,84,0.35)] cursor-pointer"
              >
                {busy ? 'Verifying…' : 'Sign in'}
              </button>
              <button
                type="button"
                onClick={() => { setStep('mobile'); setOtp(''); setInfo(''); }}
                className="w-full text-xs text-[#636363] hover:text-[#26472B] font-open-sauce-medium cursor-pointer"
              >
                ← Change mobile
              </button>
            </form>
          )}

          {info && (
            <div className="mt-4 text-xs text-[#26472B] bg-[#F2F9F1] border border-[#D6EBCF] rounded-lg px-3 py-2.5 font-open-sauce">
              {info}
            </div>
          )}
          {error && (
            <div className="mt-4 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 font-open-sauce">
              {error}
            </div>
          )}

          <div className="mt-7 pt-5 border-t border-[#EEF5EC] space-y-2">
            <div className="text-[11px] uppercase tracking-wider text-[#909090] font-open-sauce-semibold text-center">
              Dev quick access
            </div>
            <div className="flex flex-wrap justify-center gap-1.5 text-[11px]">
              {ROLES.map((r) => (
                <span key={r.id} className="px-2 py-1 rounded-md bg-[#F5F7F5] text-[#636363] font-open-sauce">
                  {r.label}: <code className="text-[#26472B] font-open-sauce-semibold">{r.dial}{r.local}</code>
                </span>
              ))}
            </div>
            {/* Bug_03/07/17 fix: only show master OTP hint in non-production environments */}
            {process.env.NODE_ENV !== 'production' && (
              <div className="text-center text-[11px] text-[#636363] font-open-sauce">
                Master OTP:{' '}
                <code className="bg-[#F2F9F1] text-[#26472B] px-2 py-0.5 rounded font-open-sauce-bold">1234</code>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StaffLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-[#636363] font-open-sauce">
          Loading…
        </div>
      }
    >
      <StaffLoginInner />
    </Suspense>
  );
}
