/**
 * useCmsOverlay — Phase 6 client-side CMS overlay hooks.
 *
 * Goal: every customer-facing string and media URL is editable from
 * the CMS without changing component code or layout. Existing
 * components keep their visual structure (no UI/UX redesign) — they
 * just call these hooks instead of using hardcoded values directly.
 *
 * Strategy: layer ON TOP of next-intl + the central media library
 * rather than replace them. When the CMS has a value the hook
 * returns it; when it doesn't, the hook falls through to the
 * existing translation file or the hardcoded fallback. Empty CMS =
 * today's UI exactly. Populated CMS = same layout, dynamic content.
 *
 * Three hooks:
 *
 *   useTranslationsWithCms(namespace)
 *     Drop-in replacement for next-intl's useTranslations.
 *     Returns a `t(key)` function that checks CMS first, then falls
 *     back to next-intl. Same call signature; zero migration cost.
 *
 *   useCmsMedia(key, fallbackSrc)
 *     Returns a media URL for a logical key (e.g. 'homepage.hero.image').
 *     Falls back to the hardcoded path passed as the 2nd arg when CMS
 *     hasn't been populated.
 *
 *   useCmsListOverlay(key, fallbackArray)
 *     Returns an array (e.g. testimonials, client logos, talent cards).
 *     CMS overrides the whole list; fallback used when missing.
 *
 * All three are SAFE to use everywhere because they degrade gracefully.
 * Migration recipe per component:
 *   1. import { useTranslationsWithCms } from '@/lib/hooks/useCmsOverlay'
 *   2. replace `useTranslations(...)` → `useTranslationsWithCms(...)`
 *   3. wrap any `<Image src="/foo" />` in `useCmsMedia('cms.key', '/foo')`
 *   4. ship — empty CMS keeps today's UI, populated CMS goes live
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations as useIntl, useLocale } from 'next-intl';
import axiosInstance from '../axios/axiosInstance';

// Module-scoped session caches.
const _overlayCache = new Map(); // ${country}:${locale}:${namespace} → { key: value }
const _mediaCache   = new Map(); // ${country}:${key}                  → url
const _listCache    = new Map(); // ${country}:${key}                  → array
const TTL_MS = 60_000;

function cacheGet(map, key) {
  const e = map.get(key);
  if (!e) return null;
  if (Date.now() - e.t > TTL_MS) { map.delete(key); return null; }
  return e.v;
}
function cacheSet(map, key, v) { map.set(key, { v, t: Date.now() }); }

function readCookie(name) {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}
function getActiveCountry() {
  return (readCookie('qh_country') || 'IN').toUpperCase();
}

/* ──────────────────────────────────────────────────────────────────
 *  useTranslationsWithCms(namespace)
 * ────────────────────────────────────────────────────────────────── */
export function useTranslationsWithCms(namespace) {
  const intlT  = useIntl(namespace);
  const locale = useLocale();
  const country = getActiveCountry();

  const cKey = `${country}:${locale}:${namespace}`;
  const [overlay, setOverlay] = useState(() => cacheGet(_overlayCache, cKey));

  useEffect(() => {
    if (overlay) return;
    let cancelled = false;
    axiosInstance.get('/cms-overlay/translations/overlay', {
      params: { namespace, locale, country },
    })
      .then((r) => {
        if (cancelled) return;
        const v = (r?.data && r.data.data) || {};
        cacheSet(_overlayCache, cKey, v);
        setOverlay(v);
      })
      .catch(() => { if (!cancelled) setOverlay({}); });
    return () => { cancelled = true; };
  }, [cKey, namespace, locale, country, overlay]);

  // CMS-first; fall through to next-intl. Preserves intl's interpolation
  // for the fallback path; CMS payloads are plain strings (interpolation
  // can be added when first author actually needs it).
  return useMemo(() => {
    return (key, vars) => {
      if (overlay && overlay[key] != null) return String(overlay[key]);
      try { return intlT(key, vars); } catch { return key; }
    };
  }, [overlay, intlT]);
}

/* ──────────────────────────────────────────────────────────────────
 *  useCmsMedia(key, fallbackSrc)
 * ────────────────────────────────────────────────────────────────── */
export function useCmsMedia(key, fallbackSrc) {
  const country = getActiveCountry();
  const cKey = `${country}:${key}`;
  const [resolved, setResolved] = useState(() => cacheGet(_mediaCache, cKey) ?? fallbackSrc);

  useEffect(() => {
    const cached = cacheGet(_mediaCache, cKey);
    if (cached) { setResolved(cached); return; }
    let cancelled = false;
    axiosInstance.get('/cms-media/by-key', { params: { key, country } })
      .then((r) => {
        if (cancelled) return;
        const url = r?.data?.data?.url || fallbackSrc;
        cacheSet(_mediaCache, cKey, url);
        setResolved(url);
      })
      .catch(() => { if (!cancelled) setResolved(fallbackSrc); });
    return () => { cancelled = true; };
  }, [cKey, key, fallbackSrc, country]);

  return resolved;
}

/* ──────────────────────────────────────────────────────────────────
 *  useCmsListOverlay(key, fallback)
 *  Use for client logos, testimonials, talent cards.
 * ────────────────────────────────────────────────────────────────── */
export function useCmsListOverlay(key, fallback = []) {
  const country = getActiveCountry();
  const cKey = `${country}:${key}`;
  const [items, setItems] = useState(() => cacheGet(_listCache, cKey) || fallback);

  useEffect(() => {
    const cached = cacheGet(_listCache, cKey);
    if (cached) { setItems(cached); return; }
    let cancelled = false;
    axiosInstance.get('/cms-overlay/lists/by-key', { params: { key, country } })
      .then((r) => {
        if (cancelled) return;
        const arr = Array.isArray(r?.data?.data) ? r.data.data : null;
        if (arr && arr.length) {
          cacheSet(_listCache, cKey, arr);
          setItems(arr);
        } else {
          setItems(fallback);
        }
      })
      .catch(() => { if (!cancelled) setItems(fallback); });
    return () => { cancelled = true; };
  }, [cKey, key, country]);

  return items;
}
