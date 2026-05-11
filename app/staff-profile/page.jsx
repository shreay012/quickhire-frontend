'use client';

/**
 * Staff Profile Editor — single page used by every staff role
 * (super_admin / admin / pm / resource / seo / finance / etc.).
 *
 * Why a single page (not one per portal):
 *   • The fields are identical across roles (name, email, E.164 mobile, avatar).
 *   • Backend enforces the role-aware bits (R5, country scope) on the
 *     write endpoint, so this UI just needs to render the form.
 *   • Linked from the avatar dropdown in StaffShell so every shell shares it.
 *
 * Backend:
 *   GET  /api/user/profile        — fetch current values
 *   PUT  /api/user/profile        — multipart (name, email, mobile, avatar)
 *                                  also re-issues a JWT with the new
 *                                  email/mobile claims so the next
 *                                  request passes the profile-complete
 *                                  middleware without a logout.
 *
 * On save, we:
 *   1. POST the update
 *   2. If the response includes a fresh token, update staffAuth so the
 *      user's session immediately reflects the new contact info.
 *   3. Show a toast + brief delay then redirect back to the role's home.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import staffApi, { staffAuth } from '@/lib/axios/staffApi';
import { showSuccess, showError } from '@/lib/utils/toast';

const DIAL_CODES = [
  { code: '+91',  label: '🇮🇳 India (+91)' },
  { code: '+971', label: '🇦🇪 UAE (+971)' },
  { code: '+49',  label: '🇩🇪 Germany (+49)' },
  { code: '+1',   label: '🇺🇸 USA / Canada (+1)' },
  { code: '+61',  label: '🇦🇺 Australia (+61)' },
];

function homeForRole(role, country) {
  const c = (country || 'in').toLowerCase();
  if (role === 'super_admin') return '/super-admin';
  if (role === 'admin')       return `/admin/${c}`;
  if (role === 'pm')          return `/pm/${c}`;
  if (role === 'resource')    return `/resource/${c}`;
  if (role === 'seo')         return '/seo-admin';
  if (role === 'finance')     return '/finance';
  return '/staff-login';
}

// Split a full E.164 mobile into ({ dial, local }) so the country-code
// dropdown stays in sync with the local digits.
function splitMobile(mobile) {
  if (!mobile || typeof mobile !== 'string') return { dial: '+91', local: '' };
  for (const c of DIAL_CODES) {
    if (mobile.startsWith(c.code)) {
      return { dial: c.code, local: mobile.slice(c.code.length) };
    }
  }
  // Unknown country code — default to +91 and pass through.
  return { dial: '+91', local: mobile.replace(/[^0-9]/g, '') };
}

export default function StaffProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState(false);

  const [user, setUser]   = useState(null);  // hydrated from /user/profile
  const [name, setName]   = useState('');
  const [email, setEmail] = useState('');
  const [dial, setDial]   = useState('+91');
  const [local, setLocal] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');

  // Auth gate — bounce to staff-login if no session
  useEffect(() => {
    const u = staffAuth.getUser();
    if (!u) { router.replace('/staff-login'); return; }
    // Fetch the canonical profile from the server. We prefer the API copy
    // over the JWT/session because JWT is immutable per token whereas the
    // user can edit profile and we want to show the latest DB state.
    let cancelled = false;
    staffApi.get('/user/profile')
      .then((r) => {
        if (cancelled) return;
        const data = r.data?.data || u;
        setUser(data);
        setName(data.name || '');
        setEmail(data.email || '');
        const split = splitMobile(data.mobile || '');
        setDial(split.dial);
        setLocal(split.local);
        if (data.avatarUrl) setAvatarPreview(data.avatarUrl);
      })
      .catch(() => {
        // Backend down or 403 — fall back to staffAuth's cached user.
        if (cancelled) return;
        setUser(u);
        setName(u.name || '');
        setEmail(u.email || '');
        const split = splitMobile(u.mobile || '');
        setDial(split.dial);
        setLocal(split.local);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [router]);

  const fullMobile = useMemo(() => {
    const digits = (local || '').replace(/\D/g, '');
    return digits ? `${dial}${digits}` : '';
  }, [dial, local]);

  const onAvatarChange = (e) => {
    const f = e.target.files?.[0] || null;
    setAvatarFile(f);
    if (f) {
      try {
        const url = URL.createObjectURL(f);
        setAvatarPreview(url);
      } catch { /* ignore preview failure */ }
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!name || name.trim().length < 1) { setError('Please enter your name.'); return; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Please enter a valid email address.'); return; }
    if (!fullMobile || !/^\+[1-9]\d{7,14}$/.test(fullMobile)) { setError('Please enter a valid mobile number (digits after the country code).'); return; }

    setSaving(true);
    try {
      // Multipart so the avatar file fits the same endpoint.
      const fd = new FormData();
      fd.append('name', name.trim());
      fd.append('email', email.trim());
      fd.append('mobile', fullMobile);
      if (avatarFile) fd.append('avatar', avatarFile);

      const res = await staffApi.put('/user/profile', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const data = res.data?.data || {};

      // Pull a fresh access token if backend returned one. Otherwise just
      // update the cached user blob so the avatar/initials refresh.
      const token = data.token || res.data?.token;
      const newUser = { ...user, ...data, name: name.trim(), email: email.trim(), mobile: fullMobile };
      if (token) {
        staffAuth.setSession({ token, user: newUser });
      } else if (staffAuth.setUser) {
        staffAuth.setUser(newUser);
      }

      setSuccess(true);
      showSuccess('Profile saved');
      // Brief delay so the user sees the success state, then go home.
      setTimeout(() => {
        router.replace(homeForRole(newUser.role, newUser.country));
      }, 900);
    } catch (e2) {
      showError(e2?.response?.data?.error?.message || 'Save failed. Please try again.');
      setError(e2?.response?.data?.error?.message || 'Save failed. Please try again.');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F7F5]">
        <div className="flex items-center gap-3 text-[#26472B] text-sm font-open-sauce-semibold">
          <span className="w-4 h-4 rounded-full border-2 border-[#45A735] border-t-transparent animate-spin" />
          Loading profile…
        </div>
      </div>
    );
  }

  const initials = (name || user?.name || '?')
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[#F5F7F5] py-8 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-open-sauce-bold text-[#26472B]">My Profile</h1>
            <p className="text-sm text-[#636363] mt-1">
              Update your contact details. Changes save to the database immediately and re-issue your session token.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.replace(homeForRole(user?.role, user?.country))}
            className="px-3 py-1.5 rounded-lg text-xs font-open-sauce-semibold text-[#26472B] bg-white ring-1 ring-[#D6EBCF] hover:bg-[#F2F9F1]"
          >
            ← Back
          </button>
        </div>

        <form
          onSubmit={submit}
          className="bg-white rounded-2xl shadow-[0_1px_4px_rgba(38,71,43,0.04)] border border-[#E5F1E2] p-6 sm:p-8 space-y-6"
        >
          {/* Role + country chips (read-only — these are server-controlled) */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-[#909090] font-open-sauce-semibold">
              Role
            </span>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-open-sauce-bold bg-[#F2F9F1] text-[#26472B] ring-1 ring-[#D6EBCF] capitalize">
              {(user?.role || 'user').replace('_', ' ')}
            </span>
            {user?.country ? (
              <>
                <span className="text-[10px] uppercase tracking-wider text-[#909090] font-open-sauce-semibold ml-2">
                  Country
                </span>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-open-sauce-bold bg-blue-50 text-blue-800 ring-1 ring-blue-200">
                  {user.country}
                </span>
              </>
            ) : null}
          </div>

          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#45A735] to-[#26472B] flex items-center justify-center text-white font-open-sauce-bold text-2xl ring-4 ring-[#F2F9F1] overflow-hidden">
              {avatarPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarPreview} alt={name || 'avatar'} className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-open-sauce-semibold text-[#26472B] mb-1.5">Profile picture</label>
              <input
                type="file"
                accept="image/*"
                onChange={onAvatarChange}
                className="block text-xs text-[#636363] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#45A735] file:text-white file:font-open-sauce-semibold hover:file:bg-[#0F3B0F]"
              />
              <p className="text-[11px] text-[#909090] mt-1">JPG or PNG. ~5 MB max.</p>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-open-sauce-semibold text-[#26472B] mb-1.5">Full name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#D6EBCF] focus:outline-none focus:ring-2 focus:ring-[#45A735]/30 focus:border-[#45A735] text-sm font-open-sauce text-[#242424]"
              placeholder="e.g. Priya Sharma"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-open-sauce-semibold text-[#26472B] mb-1.5">Email address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#D6EBCF] focus:outline-none focus:ring-2 focus:ring-[#45A735]/30 focus:border-[#45A735] text-sm font-open-sauce text-[#242424]"
              placeholder="you@quickhire.dev"
            />
            <p className="text-[11px] text-[#909090] mt-1">Used for booking notifications, refund alerts, and account recovery.</p>
          </div>

          {/* Mobile (E.164) */}
          <div>
            <label className="block text-xs font-open-sauce-semibold text-[#26472B] mb-1.5">Mobile number</label>
            <div className="flex gap-2">
              <select
                value={dial}
                onChange={(e) => setDial(e.target.value)}
                className="px-3 py-2.5 rounded-lg border border-[#D6EBCF] focus:outline-none focus:ring-2 focus:ring-[#45A735]/30 focus:border-[#45A735] text-sm font-open-sauce-semibold text-[#26472B] bg-white min-w-[160px]"
              >
                {DIAL_CODES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
              <input
                type="tel"
                required
                value={local}
                onChange={(e) => setLocal(e.target.value.replace(/\D/g, '').slice(0, 15))}
                className="flex-1 px-3.5 py-2.5 rounded-lg border border-[#D6EBCF] focus:outline-none focus:ring-2 focus:ring-[#45A735]/30 focus:border-[#45A735] text-sm font-open-sauce text-[#242424]"
                placeholder="10-digit mobile"
              />
            </div>
            <p className="text-[11px] text-[#909090] mt-1">Stored as <code className="font-mono">{fullMobile || '+CCdigits'}</code>. We send OTP and SMS alerts to this number.</p>
          </div>

          {error ? (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">{error}</div>
          ) : null}

          {success ? (
            <div className="text-xs text-[#0F3B0F] bg-[#F2F9F1] border border-[#D6EBCF] rounded-lg px-3 py-2.5">
              ✓ Saved. Redirecting back to your workspace…
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2 border-t border-[#EEF5EC]">
            <button
              type="button"
              onClick={() => router.replace(homeForRole(user?.role, user?.country))}
              disabled={saving}
              className="px-4 py-2.5 rounded-lg text-sm font-open-sauce-semibold text-[#26472B] bg-[#F2F9F1] hover:bg-[#E5F1E2] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || success}
              className="px-5 py-2.5 rounded-lg bg-[#45A735] text-white font-open-sauce-semibold text-sm hover:bg-[#26472B] disabled:opacity-60 shadow-[0_4px_14px_rgba(120,235,84,0.30)]"
            >
              {saving ? 'Saving…' : success ? 'Saved ✓' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
