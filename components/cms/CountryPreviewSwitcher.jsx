/**
 * CountryPreviewSwitcher — Phase 5.1
 *
 * super_admin-only widget for previewing CMS pages as if the viewer
 * were in a specific country. Used in the staff portal nav and on
 * `/cms-preview/<slug>` to swap the active preview country without
 * editing the URL by hand.
 *
 * Behaviour:
 *   • Writes the chosen country into the `?country=XX` query param
 *     of the current URL (preserves all other params).
 *   • Persists the choice in localStorage so navigations within the
 *     admin portal remember which country super_admin is previewing.
 *   • Country admins (any role with a country profile) see only their
 *     own country and cannot switch — the switcher renders a static
 *     badge instead.
 *   • For non-staff (customer / unauthenticated) the component renders
 *     null so it can be safely dropped into any layout.
 *
 * Use:
 *
 *   import { CountryPreviewSwitcher } from '@/components/cms/CountryPreviewSwitcher';
 *
 *   // In the admin nav / staff shell:
 *   <CountryPreviewSwitcher />
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { staffAuth } from '@/lib/axios/staffApi';

const SUPPORTED = [
  { code: 'IN', flag: '🇮🇳', label: 'India' },
  { code: 'AE', flag: '🇦🇪', label: 'UAE' },
  { code: 'DE', flag: '🇩🇪', label: 'Germany' },
  { code: 'US', flag: '🇺🇸', label: 'USA' },
  { code: 'AU', flag: '🇦🇺', label: 'Australia' },
];

const STORAGE_KEY = 'qh_admin_preview_country';

export function CountryPreviewSwitcher({ className = '' }) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  const [user, setUser] = useState(null);
  const [activeCode, setActiveCode] = useState('');

  // Resolve the staff user from localStorage on mount (avoid SSR mismatch).
  useEffect(() => {
    setUser(staffAuth.getUser());
  }, []);

  // Initial active country: URL ?country= → localStorage → user.country (for country admins).
  useEffect(() => {
    if (!user) return;
    const fromUrl   = (searchParams.get('country') || '').toUpperCase();
    const fromStore = (typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY)) || '';
    const fromUser  = (user.country || '').toUpperCase();
    setActiveCode(fromUrl || fromStore || fromUser || 'IN');
  }, [user, searchParams]);

  const isSuperAdmin = user?.role === 'super_admin';
  const ownCountry   = (user?.country || '').toUpperCase();

  // Country admin / non-super-admin staff with a country: pinned, no switching.
  // Non-staff: render nothing.
  const visible = useMemo(() => {
    if (!user) return null;
    if (isSuperAdmin) return SUPPORTED;
    if (ownCountry)   return SUPPORTED.filter((c) => c.code === ownCountry);
    return null;
  }, [user, isSuperAdmin, ownCountry]);

  if (!visible) return null;

  const onPick = (code) => {
    setActiveCode(code);
    if (typeof window !== 'undefined') {
      try { localStorage.setItem(STORAGE_KEY, code); } catch { /* private mode etc */ }
    }
    // Update URL ?country= so the active preview reloads to the new country.
    const params = new URLSearchParams(searchParams.toString());
    params.set('country', code);
    router.replace(`${pathname}?${params.toString()}`);
  };

  // Pinned country admin view — read-only badge.
  if (!isSuperAdmin && visible.length === 1) {
    const c = visible[0];
    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F2F9F1] border border-[#D6EBCF] text-[#26472B] text-xs font-open-sauce-semibold ${className}`}
        title={`Country admin scope — pinned to ${c.label}`}
      >
        <span aria-hidden>{c.flag}</span>
        <span>{c.code}</span>
      </span>
    );
  }

  // super_admin view — clickable chips.
  return (
    <div className={`inline-flex items-center gap-1 ${className}`}
         role="group" aria-label="Preview country">
      {SUPPORTED.map((c) => {
        const active = c.code === activeCode;
        return (
          <button
            key={c.code}
            type="button"
            onClick={() => onPick(c.code)}
            title={`Preview as ${c.label}`}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-open-sauce-semibold border transition-colors ${
              active
                ? 'bg-[#45A735] border-[#45A735] text-white'
                : 'bg-white border-[#D6EBCF] text-[#26472B] hover:bg-[#F2F9F1]'
            }`}
            aria-pressed={active}
          >
            <span aria-hidden>{c.flag}</span>
            <span>{c.code}</span>
          </button>
        );
      })}
    </div>
  );
}

export default CountryPreviewSwitcher;
