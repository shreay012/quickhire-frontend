'use client';
// Phase G (2026-05-11): re-export the page-builder so it works under the
// country-admin shell. The builder reads the page id from the URL via
// useParams() — that works equally well at /admin/cms/pages/X and at
// /admin/IN/cms/pages/X because Next.js exposes ALL route params.
export { default } from '@/app/admin/cms/pages/[id]/page';
