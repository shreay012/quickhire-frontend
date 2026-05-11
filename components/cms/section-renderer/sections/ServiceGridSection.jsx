/**
 * ServiceGridSection — driven by section.config.filter.
 *
 * Unlike hero / FAQ which carry their content inline as content_blocks,
 * this section pulls live data from the existing `/services` API. The
 * CMS author sets:
 *
 *   section.config = {
 *     showCount: 6,
 *     filter: { category: ['engineering','design'] }
 *   }
 *
 * and the renderer queries /services?country=... and filters client-side
 * (the catalogue is small enough — typically <100 rows).
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import axiosInstance from '@/lib/axios/axiosInstance';

export default function ServiceGridSection({ section }) {
  const [services, setServices] = useState(null);
  const [error, setError] = useState(null);
  const showCount = section?.config?.showCount || 6;
  const categoryFilter = section?.config?.filter?.category;

  useEffect(() => {
    let cancelled = false;
    axiosInstance.get('/services')
      .then((r) => {
        if (cancelled) return;
        let items = r.data?.data || [];
        if (Array.isArray(categoryFilter) && categoryFilter.length) {
          items = items.filter((s) => categoryFilter.includes(s.category));
        }
        setServices(items.slice(0, showCount));
      })
      .catch((e) => !cancelled && setError(e?.response?.data?.error?.message || 'Could not load services'));
    return () => { cancelled = true; };
  }, [showCount, JSON.stringify(categoryFilter)]);

  if (error) {
    return (
      <section className="w-full max-w-6xl mx-auto px-6 py-12">
        <p className="text-center text-[#909090] text-sm">{error}</p>
      </section>
    );
  }
  if (services === null) {
    return (
      <section className="w-full max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: showCount }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-[#F5F5F5] animate-pulse" />
          ))}
        </div>
      </section>
    );
  }
  if (!services.length) {
    return (
      <section className="w-full max-w-6xl mx-auto px-6 py-12">
        <p className="text-center text-[#909090]">No services available right now.</p>
      </section>
    );
  }
  return (
    <section className="w-full max-w-6xl mx-auto px-6 py-12">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map((s) => (
          <Link key={s._id || s.slug} href={`/service-details/${s.slug}`}
            className="block bg-white rounded-xl border border-[#D6EBCF] p-5 hover:shadow-md hover:border-[#45A735] transition-all">
            <h3 className="font-open-sauce-semibold text-lg text-[#26472B] mb-1">
              {typeof s.name === 'object' ? (s.name.en || Object.values(s.name)[0]) : s.name}
            </h3>
            {s.tagline ? (
              <p className="text-sm text-[#636363] line-clamp-2">
                {typeof s.tagline === 'object' ? (s.tagline.en || Object.values(s.tagline)[0]) : s.tagline}
              </p>
            ) : null}
          </Link>
        ))}
      </div>
    </section>
  );
}
