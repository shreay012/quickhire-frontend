'use client';
// Phase G (2026-05-11): Page Builder list under the country-admin shell.
// We use a NEW route prefix `page-builder/` instead of overwriting the
// existing `pages/` (which is the legacy CMS-x list and still has its
// own consumers). Once operators migrate fully off the legacy CMS-x,
// `pages/` can be retired.
// Re-export the NEW Phase G list (calls /cms-pages/admin/pages where the
// 30 seeded customer-facing pages live), not the legacy CMS-x list.
export { default } from '@/app/admin/cms/page-builder/page';
