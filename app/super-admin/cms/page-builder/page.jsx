'use client';
// Re-export the NEW Phase G page-builder list (calls /cms-pages/admin/pages,
// the modern endpoint where the 30 seeded customer-facing pages live).
// The OLD `/admin/cms/pages` list (calling legacy /cms-x/pages) stays alive
// at its own route for the legacy single-doc CMS flow.
export { default } from '@/app/admin/cms/page-builder/page';
