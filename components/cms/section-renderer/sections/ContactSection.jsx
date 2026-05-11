/**
 * ContactSection — Phase E (2026-05-10)
 *
 * Contact info card + optional inline lead-form. The form posts to
 * `POST /api/miscellaneous/contact-us` (already implemented and public).
 *
 * Expected blocks:
 *   { type: 'section_title', content: { title: i18n, subtitle: i18n } }
 *   { type: 'contact_info',  content: {
 *       email: string, phone: string, address: i18n,
 *       hours: i18n, mapEmbedUrl: string
 *   }}
 *   { type: 'cta', content: { label: i18n, target: '/...' } }   // optional
 *
 * Section config (optional):
 *   { showForm: bool }
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { findBlock, pickI18n } from '../blocks.js';
import axiosInstance from '@/lib/axios/axiosInstance';

export default function ContactSection({ section, locale = 'en' }) {
  const titleBlock = findBlock(section, 'section_title');
  const infoBlock  = findBlock(section, 'contact_info');
  const ctaBlock   = findBlock(section, 'cta');
  const showForm   = !!section?.config?.showForm;

  const title    = pickI18n(titleBlock?.content?.title, locale);
  const subtitle = pickI18n(titleBlock?.content?.subtitle, locale);

  const info = infoBlock?.content || {};
  const cta  = ctaBlock?.content || null;

  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr]   = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      await axiosInstance.post('/miscellaneous/contact-us', form);
      setDone(true);
    } catch (e2) {
      setErr(e2?.response?.data?.error?.message || 'Failed to send. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="w-full py-14 px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        {(title || subtitle) ? (
          <div className="text-center mb-10">
            {title ? <h2 className="text-3xl md:text-4xl font-open-sauce-bold text-[#26472B] mb-3">{title}</h2> : null}
            {subtitle ? <p className="text-base text-[#636363] max-w-2xl mx-auto">{subtitle}</p> : null}
          </div>
        ) : null}

        <div className={`grid grid-cols-1 ${showForm ? 'lg:grid-cols-2' : 'lg:grid-cols-1'} gap-8`}>
          {/* Info card */}
          <div className="rounded-2xl bg-[#F7FBF6] ring-1 ring-[#E5F1E2] p-6 md:p-8 space-y-4">
            {info.email ? (
              <div>
                <div className="text-xs font-open-sauce-semibold uppercase tracking-wider text-[#909090]">Email</div>
                <a href={`mailto:${info.email}`} className="text-[#45A735] font-open-sauce-semibold hover:underline">{info.email}</a>
              </div>
            ) : null}
            {info.phone ? (
              <div>
                <div className="text-xs font-open-sauce-semibold uppercase tracking-wider text-[#909090]">Phone</div>
                <a href={`tel:${info.phone}`} className="text-[#26472B] font-open-sauce-semibold">{info.phone}</a>
              </div>
            ) : null}
            {pickI18n(info.address, locale) ? (
              <div>
                <div className="text-xs font-open-sauce-semibold uppercase tracking-wider text-[#909090]">Address</div>
                <div className="text-[#26472B]">{pickI18n(info.address, locale)}</div>
              </div>
            ) : null}
            {pickI18n(info.hours, locale) ? (
              <div>
                <div className="text-xs font-open-sauce-semibold uppercase tracking-wider text-[#909090]">Hours</div>
                <div className="text-[#26472B]">{pickI18n(info.hours, locale)}</div>
              </div>
            ) : null}
            {info.mapEmbedUrl ? (
              <iframe
                title="Office location"
                src={info.mapEmbedUrl}
                className="w-full h-48 rounded-lg border-0 mt-3"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : null}
            {cta?.label ? (
              <Link
                href={cta.target || '#'}
                className="inline-block mt-2 px-5 py-2.5 rounded-full bg-[#45A735] text-white font-open-sauce-semibold text-sm hover:bg-[#0F3B0F]"
              >
                {pickI18n(cta.label, locale)}
              </Link>
            ) : null}
          </div>

          {/* Inline form */}
          {showForm ? (
            <form onSubmit={submit} className="rounded-2xl bg-white ring-1 ring-[#E5F1E2] p-6 md:p-8 space-y-4">
              {done ? (
                <div className="text-[#0F3B0F] bg-[#F2F9F1] ring-1 ring-[#D6EBCF] rounded-lg px-4 py-3 text-sm">
                  ✓ Message sent. We&rsquo;ll be in touch within 24 hours.
                </div>
              ) : (
                <>
                  <input
                    type="text" required placeholder="Your name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg border border-[#D6EBCF] focus:outline-none focus:ring-2 focus:ring-[#45A735]/30 focus:border-[#45A735]"
                  />
                  <input
                    type="email" required placeholder="Email address"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg border border-[#D6EBCF] focus:outline-none focus:ring-2 focus:ring-[#45A735]/30 focus:border-[#45A735]"
                  />
                  <textarea
                    required placeholder="How can we help?"
                    rows={4}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg border border-[#D6EBCF] focus:outline-none focus:ring-2 focus:ring-[#45A735]/30 focus:border-[#45A735]"
                  />
                  {err ? <div className="text-xs text-red-700 bg-red-50 ring-1 ring-red-200 rounded-lg px-3 py-2">{err}</div> : null}
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full py-2.5 rounded-lg bg-[#45A735] text-white font-open-sauce-semibold hover:bg-[#0F3B0F] disabled:opacity-50"
                  >
                    {busy ? 'Sending…' : 'Send message'}
                  </button>
                </>
              )}
            </form>
          ) : null}
        </div>
      </div>
    </section>
  );
}
