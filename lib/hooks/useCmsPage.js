/**
 * useCmsPage — Phase 3.6 hook for CMS-driven pages.
 *
 * Fetches /api/cms-pages/:slug (country-aware) and caches the result
 * in module-scoped Map keyed by `${country}:${slug}` for the session.
 * 60-second freshness is matched on the server side too.
 *
 * Usage:
 *
 *   const { page, sections, loading, error, refresh } = useCmsPage('homepage');
 *
 *   return (
 *     <>{sections.map((s) => <SectionRenderer key={s.id} section={s} />)}</>
 *   );
 *
 * The hook respects the customer-facing axiosInstance — it falls
 * through gracefully when the API is unreachable.
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import axiosInstance from '../axios/axiosInstance';

// Module-scoped session cache. Cleared on page reload.
const _cache = new Map();
const TTL_MS = 60_000;

function cacheGet(key) {
  const e = _cache.get(key);
  if (!e) return null;
  if (Date.now() - e.t > TTL_MS) {
    _cache.delete(key);
    return null;
  }
  return e.v;
}
function cacheSet(key, v) {
  _cache.set(key, { v, t: Date.now() });
}

export function useCmsPage(slug, opts = {}) {
  const { country, includeDisabled = false } = opts;
  const [state, setState] = useState({ loading: true, error: null, page: null, sections: [] });

  const key = `${country || 'auto'}:${slug}:${includeDisabled ? 'all' : 'pub'}`;

  const fetchIt = useCallback(async () => {
    const cached = cacheGet(key);
    if (cached) {
      setState({ loading: false, error: null, page: cached.page, sections: cached.sections });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const params = {};
      if (country) params.country = country;
      if (includeDisabled) params.includeDisabled = 'true';
      const r = await axiosInstance.get(`/cms-pages/${encodeURIComponent(slug)}`, { params });
      const data = r.data?.data || { page: null, sections: [] };
      cacheSet(key, data);
      setState({ loading: false, error: null, page: data.page, sections: data.sections || [] });
    } catch (e) {
      setState({
        loading: false,
        error: e?.response?.data?.error?.message || 'Failed to load page',
        page: null,
        sections: [],
      });
    }
  }, [key, slug, country, includeDisabled]);

  useEffect(() => { fetchIt(); }, [fetchIt]);

  return {
    ...state,
    refresh: () => { _cache.delete(key); return fetchIt(); },
  };
}
