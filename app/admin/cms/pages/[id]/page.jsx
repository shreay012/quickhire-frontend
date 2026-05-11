'use client';

/**
 * Page Builder — Phase G (2026-05-11)
 *
 * Full-screen visual editor for a CMS page. Lets operators:
 *   • View page metadata (slug, status, country, title)
 *   • Reorder sections (move ▲/▼ — calls /admin/pages/:pageId/sections/reorder)
 *   • Enable / disable / delete sections
 *   • Add new sections (picks from the registered renderer types)
 *   • Edit each section's blocks (move/add/delete/edit content as JSON)
 *   • Save & publish the page
 *
 * Drag-drop alternative: this build uses ▲/▼ arrows for reorder to avoid
 * adding a new dependency. The backend reorder endpoint is identical.
 *
 * Backend used:
 *   GET    /api/cms-pages/admin/pages/:id              — single page tree
 *   PATCH  /api/cms-pages/admin/pages/:id              — page metadata
 *   POST   /api/cms-pages/admin/pages/:id/sections     — add section
 *   PATCH  /api/cms-pages/admin/sections/:id           — toggle/edit section
 *   DELETE /api/cms-pages/admin/sections/:id           — remove section
 *   POST   /api/cms-pages/admin/pages/:id/sections/reorder
 *   POST   /api/cms-pages/admin/sections/:id/blocks    — add block
 *   PATCH  /api/cms-pages/admin/blocks/:id             — edit block content
 *   DELETE /api/cms-pages/admin/blocks/:id             — remove block
 *   POST   /api/cms-pages/admin/sections/:id/blocks/reorder
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import staffApi from '@/lib/axios/staffApi';
import { showSuccess, showError } from '@/lib/utils/toast';
import {
  PageHeader,
  Spinner,
  ErrorBox,
  Button,
  EmptyState,
  SectionCard,
  Card,
  StatusBadge,
} from '@/components/staff/ui';

// Section + block type registries — keep in sync with frontend renderer
// registry at `components/cms/section-renderer/index.jsx`. When a new
// renderer ships, append its `type` here so it shows up in the picker.
const SECTION_TYPES = [
  { type: 'hero_banner',  label: 'Hero banner',       blocks: ['headline', 'subhead', 'cta', 'video'] },
  { type: 'service_grid', label: 'Service grid',      blocks: ['section_title'] },
  { type: 'faq',          label: 'FAQ accordion',     blocks: ['section_title', 'faq_item'] },
  { type: 'testimonials', label: 'Testimonials',      blocks: ['section_title', 'testimonial'] },
  { type: 'client_logos', label: 'Client logos',      blocks: ['section_title', 'client_logo'] },
  { type: 'statistics',   label: 'Statistics strip',  blocks: ['section_title', 'stat'] },
  { type: 'video',        label: 'Video',             blocks: ['section_title', 'video'] },
  { type: 'contact',      label: 'Contact',           blocks: ['section_title', 'contact_info', 'cta'] },
  { type: 'cta',          label: 'Call to action',    blocks: ['section_title', 'cta'] },
];

const BLOCK_TYPE_LABELS = {
  headline:    'Headline',
  subhead:     'Subhead',
  cta:         'CTA button',
  video:       'Video',
  section_title: 'Title / subtitle',
  faq_item:    'FAQ item',
  testimonial: 'Testimonial',
  client_logo: 'Logo',
  stat:        'Stat number',
  contact_info:'Contact info',
};

export default function PageBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const pageId = params?.id;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingReorder, setSavingReorder] = useState(false);
  const [addingSection, setAddingSection] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!pageId) return;
    queueMicrotask(() => setLoading(true));
    let cancelled = false;
    staffApi
      .get(`/cms-pages/admin/pages/${pageId}`)
      .then((r) => { if (!cancelled) setData(r.data?.data || null); })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [pageId, refreshKey]);

  const reload = useCallback(() => setRefreshKey((k) => k + 1), []);

  if (loading) return (
    <div className="p-8">
      <Spinner />
    </div>
  );
  if (error) return (
    <div className="p-8">
      <ErrorBox error={error} />
    </div>
  );
  if (!data?.page) return (
    <div className="p-8">
      <EmptyState message="Page not found" description="The page id is invalid or you don't have access." />
    </div>
  );

  const { page, sections } = data;

  // Reorder a section (move up/down). The backend reorder endpoint takes
  // `{ ids: [...] }` where position in the array implies the new orderIdx.
  const moveSection = async (idx, delta) => {
    const newIdx = idx + delta;
    if (newIdx < 0 || newIdx >= sections.length) return;
    const reordered = [...sections];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    const ids = reordered.map((s) => s._id);
    setSavingReorder(true);
    try {
      await staffApi.post(`/cms-pages/admin/pages/${pageId}/sections/reorder`, { ids });
      showSuccess('Order saved');
      reload();
    } catch (e) {
      showError(e?.response?.data?.error?.message || 'Reorder failed');
    } finally {
      setSavingReorder(false);
    }
  };

  const togglePageStatus = async () => {
    const next = page.status === 'published' ? 'draft' : 'published';
    if (!window.confirm(`Set page status to "${next}"?`)) return;
    try {
      await staffApi.patch(`/cms-pages/admin/pages/${pageId}`, { status: next });
      showSuccess(`Page is now ${next}`);
      reload();
    } catch (e) {
      showError(e?.response?.data?.error?.message || 'Status change failed');
    }
  };

  const toggleSectionEnabled = async (section) => {
    try {
      await staffApi.patch(`/cms-pages/admin/sections/${section._id}`, { enabled: !section.enabled });
      reload();
    } catch (e) {
      showError(e?.response?.data?.error?.message || 'Toggle failed');
    }
  };

  const deleteSection = async (section) => {
    if (!window.confirm(`Delete the "${section.type}" section? Its blocks will be removed too.`)) return;
    try {
      await staffApi.delete(`/cms-pages/admin/sections/${section._id}`);
      showSuccess('Section deleted');
      reload();
    } catch (e) {
      showError(e?.response?.data?.error?.message || 'Delete failed');
    }
  };

  const addSection = async (type) => {
    setAddingSection(false);
    try {
      const orderIdx = sections.length + 1;
      await staffApi.post(`/cms-pages/admin/pages/${pageId}/sections`, { type, orderIdx, enabled: true, config: {} });
      showSuccess(`Added ${type} section`);
      reload();
    } catch (e) {
      showError(e?.response?.data?.error?.message || 'Add failed');
    }
  };

  const previewHref = `/cms-preview/${page.slug}?country=${page.country}`;

  return (
    <div>
      <PageHeader
        title={`Edit: ${page.slug}`}
        subtitle={`${page.country} · ${sections.length} section${sections.length === 1 ? '' : 's'}`}
      />

      <div className="p-4 sm:p-8 space-y-6">
        {/* Page metadata bar */}
        <Card className="px-5 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-open-sauce-bold bg-[#F2F9F1] text-[#26472B] ring-1 ring-[#D6EBCF]">
                  {page.country}
                </span>
                <StatusBadge status={page.status} />
              </div>
              <h2 className="text-base font-open-sauce-bold text-[#26472B] truncate">{page.slug}</h2>
              <div className="text-xs text-[#909090]">
                Updated {new Date(page.updatedAt).toLocaleString()}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <a
                href={previewHref}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-lg bg-[#F2F9F1] text-[#26472B] font-open-sauce-semibold text-sm hover:bg-[#E5F1E2]"
              >
                Preview ↗
              </a>
              <Button variant="primary" size="md" onClick={togglePageStatus}>
                {page.status === 'published' ? 'Unpublish' : 'Publish'}
              </Button>
              <Button variant="subtle" size="md" onClick={() => router.push('/admin/cms/pages')}>
                Back to list
              </Button>
            </div>
          </div>
        </Card>

        {/* Section list */}
        <SectionCard
          title="Sections"
          subtitle="Drag the ▲/▼ arrows to reorder. Click a section to manage its blocks."
          action={
            <Button variant="primary" size="sm" onClick={() => setAddingSection(true)}>
              + Add section
            </Button>
          }
        >
          {sections.length === 0 ? (
            <EmptyState
              title="No sections yet"
              description="Add your first section to start building this page."
              action={<Button variant="primary" size="md" onClick={() => setAddingSection(true)}>Add section</Button>}
            />
          ) : (
            <div className="space-y-3">
              {sections.map((section, idx) => (
                <SectionRow
                  key={section._id}
                  section={section}
                  isFirst={idx === 0}
                  isLast={idx === sections.length - 1}
                  saving={savingReorder}
                  onMoveUp={() => moveSection(idx, -1)}
                  onMoveDown={() => moveSection(idx, +1)}
                  onToggle={() => toggleSectionEnabled(section)}
                  onDelete={() => deleteSection(section)}
                  onChanged={reload}
                />
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {addingSection ? (
        <AddSectionPicker
          onPick={addSection}
          onClose={() => setAddingSection(false)}
        />
      ) : null}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
 * <SectionRow> — one collapsible card per section with block editor.
 * ──────────────────────────────────────────────────────────────── */

function SectionRow({ section, isFirst, isLast, saving, onMoveUp, onMoveDown, onToggle, onDelete, onChanged }) {
  const [open, setOpen] = useState(false);
  const meta = SECTION_TYPES.find((t) => t.type === section.type) || { label: section.type, blocks: [] };

  return (
    <div className={`rounded-xl ring-1 ${section.enabled ? 'ring-[#E5F1E2]' : 'ring-[#E5E5E5] bg-[#FAFAFA]'} overflow-hidden`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst || saving}
            className="w-7 h-6 rounded text-[#636363] hover:bg-[#F7FBF6] hover:text-[#26472B] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
            aria-label="Move section up"
          >
            ▲
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast || saving}
            className="w-7 h-6 rounded text-[#636363] hover:bg-[#F7FBF6] hover:text-[#26472B] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
            aria-label="Move section down"
          >
            ▼
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-open-sauce-bold text-[#26472B]">{meta.label}</span>
            <span className="text-[10px] font-mono text-[#909090]">{section.type}</span>
            {!section.enabled ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-open-sauce-semibold bg-amber-50 text-amber-700 ring-1 ring-amber-200">
                disabled
              </span>
            ) : null}
          </div>
          <div className="text-xs text-[#636363] mt-0.5">
            {(section.blocks?.length || 0)} block{(section.blocks?.length || 0) === 1 ? '' : 's'}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onToggle}
            className="text-xs font-open-sauce-semibold text-[#26472B] hover:underline"
          >
            {section.enabled ? 'Disable' : 'Enable'}
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="px-3 py-1.5 rounded-lg bg-[#F2F9F1] text-[#26472B] font-open-sauce-semibold text-xs hover:bg-[#E5F1E2]"
          >
            {open ? 'Close' : 'Edit blocks'}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="text-xs font-open-sauce-semibold text-red-600 hover:text-red-800"
          >
            Delete
          </button>
        </div>
      </div>

      {open ? (
        <BlockEditor
          section={section}
          allowedBlockTypes={meta.blocks}
          onChanged={onChanged}
        />
      ) : null}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
 * <BlockEditor> — list of blocks under a section with move/edit/delete.
 * ──────────────────────────────────────────────────────────────── */

function BlockEditor({ section, allowedBlockTypes, onChanged }) {
  const [editing, setEditing] = useState(null);    // block being edited
  const [adding, setAdding]   = useState(false);
  const [saving, setSaving]   = useState(false);

  const blocks = section.blocks || [];

  const moveBlock = async (idx, delta) => {
    const newIdx = idx + delta;
    if (newIdx < 0 || newIdx >= blocks.length) return;
    const reordered = [...blocks];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    const ids = reordered.map((b) => b._id);
    setSaving(true);
    try {
      await staffApi.post(`/cms-pages/admin/sections/${section._id}/blocks/reorder`, { ids });
      showSuccess('Block order saved');
      onChanged();
    } catch (e) {
      showError(e?.response?.data?.error?.message || 'Reorder failed');
    } finally {
      setSaving(false);
    }
  };

  const deleteBlock = async (block) => {
    if (!window.confirm(`Delete this "${block.type}" block?`)) return;
    try {
      await staffApi.delete(`/cms-pages/admin/blocks/${block._id}`);
      showSuccess('Block deleted');
      onChanged();
    } catch (e) {
      showError(e?.response?.data?.error?.message || 'Delete failed');
    }
  };

  return (
    <div className="border-t border-[#E5F1E2] bg-[#FCFEFB] p-4 space-y-3">
      {blocks.length === 0 ? (
        <div className="text-xs text-[#636363] py-2">No blocks yet — add one to populate this section.</div>
      ) : (
        <div className="space-y-2">
          {blocks.map((block, idx) => (
            <div key={block._id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white ring-1 ring-[#E5F1E2]">
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => moveBlock(idx, -1)}
                  disabled={idx === 0 || saving}
                  className="w-6 h-5 rounded text-[10px] text-[#636363] hover:text-[#26472B] disabled:opacity-30"
                >▲</button>
                <button
                  type="button"
                  onClick={() => moveBlock(idx, +1)}
                  disabled={idx === blocks.length - 1 || saving}
                  className="w-6 h-5 rounded text-[10px] text-[#636363] hover:text-[#26472B] disabled:opacity-30"
                >▼</button>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-open-sauce-semibold text-[#26472B]">
                  {BLOCK_TYPE_LABELS[block.type] || block.type}
                </div>
                <div className="text-[11px] font-mono text-[#909090] truncate">
                  {JSON.stringify(block.content || {}).slice(0, 80)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditing(block)}
                className="text-xs font-open-sauce-semibold text-[#26472B] hover:underline"
              >Edit</button>
              <button
                type="button"
                onClick={() => deleteBlock(block)}
                className="text-xs font-open-sauce-semibold text-red-600 hover:text-red-800"
              >Delete</button>
            </div>
          ))}
        </div>
      )}

      <Button variant="primary" size="sm" onClick={() => setAdding(true)}>
        + Add block
      </Button>

      {editing ? (
        <BlockJsonModal
          block={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); onChanged(); }}
        />
      ) : null}

      {adding ? (
        <AddBlockPicker
          sectionId={section._id}
          allowedTypes={allowedBlockTypes}
          orderIdx={blocks.length + 1}
          onClose={() => setAdding(false)}
          onAdded={() => { setAdding(false); onChanged(); }}
        />
      ) : null}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
 * Modal: pick a section type to add.
 * ──────────────────────────────────────────────────────────────── */

function AddSectionPicker({ onPick, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-open-sauce-bold text-[#26472B]">Add a section</h3>
        <div className="grid grid-cols-2 gap-2">
          {SECTION_TYPES.map((t) => (
            <button
              key={t.type}
              onClick={() => onPick(t.type)}
              className="text-left px-3 py-3 rounded-lg ring-1 ring-[#E5F1E2] hover:ring-[#45A735] hover:bg-[#F7FBF6] transition-all"
            >
              <div className="text-sm font-open-sauce-semibold text-[#26472B]">{t.label}</div>
              <div className="text-[10px] font-mono text-[#909090] mt-0.5">{t.type}</div>
            </button>
          ))}
        </div>
        <div className="flex justify-end">
          <Button variant="subtle" size="md" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
 * Modal: pick a block type to add to a section.
 * ──────────────────────────────────────────────────────────────── */

function AddBlockPicker({ sectionId, allowedTypes, orderIdx, onClose, onAdded }) {
  const [type, setType] = useState(allowedTypes[0] || '');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await staffApi.post(`/cms-pages/admin/sections/${sectionId}/blocks`, {
        type,
        orderIdx,
        content: defaultContent(type),
      });
      showSuccess(`Added ${type} block`);
      onAdded();
    } catch (e2) {
      showError(e2?.response?.data?.error?.message || 'Add block failed');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <form className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3 className="text-lg font-open-sauce-bold text-[#26472B]">Add a block</h3>
        <div>
          <label className="block text-xs font-open-sauce-semibold text-[#26472B] mb-1">Block type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[#D6EBCF] focus:outline-none focus:ring-2 focus:ring-[#45A735]/30 focus:border-[#45A735] text-sm"
          >
            {allowedTypes.map((t) => (
              <option key={t} value={t}>{BLOCK_TYPE_LABELS[t] || t} ({t})</option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="subtle" size="md" type="button" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" size="md" type="submit" disabled={busy || !type}>
            {busy ? 'Adding…' : 'Add block'}
          </Button>
        </div>
      </form>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
 * Modal: edit a block's content (raw JSON for now).
 * ──────────────────────────────────────────────────────────────── */

function BlockJsonModal({ block, onClose, onSaved }) {
  const initial = useMemo(() => JSON.stringify(block.content || {}, null, 2), [block]);
  const [json, setJson] = useState(initial);
  const [parseErr, setParseErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setParseErr('');
    let content;
    try {
      content = JSON.parse(json);
    } catch (e2) {
      setParseErr(`Invalid JSON: ${e2.message}`);
      return;
    }
    setBusy(true);
    try {
      await staffApi.patch(`/cms-pages/admin/blocks/${block._id}`, { content });
      showSuccess('Block saved');
      onSaved();
    } catch (e2) {
      showError(e2?.response?.data?.error?.message || 'Save failed');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl p-6 space-y-4"
      >
        <div>
          <h3 className="text-lg font-open-sauce-bold text-[#26472B]">
            Edit {BLOCK_TYPE_LABELS[block.type] || block.type}
          </h3>
          <p className="text-xs text-[#636363] mt-1">
            Edit content as JSON. The frontend renderer reads this shape (see <code>section-renderer/sections/*.jsx</code>).
          </p>
        </div>
        <div>
          <textarea
            rows={14}
            value={json}
            onChange={(e) => setJson(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[#D6EBCF] focus:outline-none focus:ring-2 focus:ring-[#45A735]/30 focus:border-[#45A735] font-mono text-xs"
            spellCheck={false}
          />
          {parseErr ? <div className="text-xs text-red-700 mt-1">{parseErr}</div> : null}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="subtle" size="md" type="button" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" size="md" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save block'}
          </Button>
        </div>
      </form>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
 * defaultContent — minimal content scaffolding per block type so the
 * authoring flow doesn't start with `{}` (operators see hints for the
 * shape).
 * ──────────────────────────────────────────────────────────────── */

function defaultContent(type) {
  switch (type) {
    case 'headline':     return { headline: { en: '' } };
    case 'subhead':      return { sub: { en: '' } };
    case 'section_title':return { title: { en: '' }, subtitle: { en: '' } };
    case 'cta':          return { label: { en: 'Get started' }, target: '/' };
    case 'video':        return { src: '', thumbnail: '' };
    case 'faq_item':     return { question: { en: '' }, answer: { en: '' } };
    case 'testimonial':  return { quote: { en: '' }, author: { en: '' }, role: { en: '' }, avatar: '', rating: 5 };
    case 'client_logo':  return { name: '', src: '', href: '' };
    case 'stat':         return { value: '', label: { en: '' }, suffix: '' };
    case 'contact_info': return { email: '', phone: '', address: { en: '' }, hours: { en: '' }, mapEmbedUrl: '' };
    default:             return {};
  }
}
