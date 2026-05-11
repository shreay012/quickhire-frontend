'use client';
// Phase F (2026-05-11): re-export so the country-admin shell layout
// (with the country sidebar + StaffShell) wraps the editor.
// The inner page reads `user.country` from the JWT — backend enforces
// R5 — so we don't need to thread the URL `[country]` segment in.
export { default } from '@/app/admin/cms/translations/page';
