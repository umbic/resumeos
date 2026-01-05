'use client';

import { useState, useEffect } from 'react';

interface ContentItem {
  id: string;
  type: string;
  position?: number | null;
  title?: string;
  contentShort?: string | null;
  contentMedium?: string | null;
  contentLong?: string | null;
  contentGeneric?: string | null;
  brandTags?: string[];
  categoryTags?: string[];
  functionTags?: string[];
  industryTags?: string[];
  themeTags?: string[];
  outcomeTags?: string[];
  exclusiveMetrics?: string[];
}

interface Variant {
  id: string;
  base_id: string;
  variant_label: string;
  context?: string;
  method?: string;
  outcome?: string;
  content?: string;
  theme_tags?: string[];
}

interface PositionBulletVariant {
  id: string;
  baseId: string;
  variantLabel: string;
  themeTags: string[];
  contentLong: string;
  functionTags: string[];
  industryTags: string[];
  exclusiveMetrics: string[];
}

interface PositionBulletData {
  correspondingCH: string;
  base: {
    id: string;
    type: string;
    position: number;
    contentLong: string;
    functionTags: string[];
    exclusiveMetrics: string[];
  };
  variants: PositionBulletVariant[];
  variantCount: number;
}

export default function AdminContentPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [contentDatabase, setContentDatabase] = useState<{ items: ContentItem[]; conflictRules: unknown[] } | null>(null);
  const [variants, setVariants] = useState<{ base_items: unknown[]; variants: Variant[]; overview_variants: unknown[] } | null>(null);
  const [positionBulletVariants, setPositionBulletVariants] = useState<{ metadata: unknown; positionBulletVariants: Record<string, PositionBulletData> } | null>(null);

  const [activeTab, setActiveTab] = useState<'summaries' | 'highlights' | 'overviews' | 'bullets' | 'pbv'>('summaries');
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadContent();
  }, []);

  async function loadContent() {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/content');
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setContentDatabase(data.contentDatabase);
      setVariants(data.variants);
      setPositionBulletVariants(data.positionBulletVariants);
      setHasChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load content');
    } finally {
      setLoading(false);
    }
  }

  async function saveFile(file: string, data: unknown) {
    try {
      setSaving(true);
      setError(null);
      const res = await fetch('/api/admin/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file, data }),
      });
      const result = await res.json();
      if (result.error) throw new Error(result.error);

      setSuccess(`Saved ${file} successfully! Backup created.`);
      setHasChanges(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function updateContentItem(id: string, field: string, value: string | string[] | null) {
    if (!contentDatabase) return;
    const updated = {
      ...contentDatabase,
      items: contentDatabase.items.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    };
    setContentDatabase(updated);
    setHasChanges(true);
  }

  function updateVariant(id: string, field: string, value: string | string[]) {
    if (!variants) return;
    const updated = {
      ...variants,
      variants: variants.variants.map(v =>
        v.id === id ? { ...v, [field]: value } : v
      ),
    };
    setVariants(updated);
    setHasChanges(true);
  }

  function updatePBVariant(baseId: string, variantId: string, field: string, value: string | string[]) {
    if (!positionBulletVariants) return;
    const updated = {
      ...positionBulletVariants,
      positionBulletVariants: {
        ...positionBulletVariants.positionBulletVariants,
        [baseId]: {
          ...positionBulletVariants.positionBulletVariants[baseId],
          variants: positionBulletVariants.positionBulletVariants[baseId].variants.map(v =>
            v.id === variantId ? { ...v, [field]: value } : v
          ),
        },
      },
    };
    setPositionBulletVariants(updated);
    setHasChanges(true);
  }

  function getFilteredItems() {
    if (!contentDatabase) return [];
    const search = searchTerm.toLowerCase();
    return contentDatabase.items.filter(item => {
      const typeMatch =
        (activeTab === 'summaries' && item.type === 'summary') ||
        (activeTab === 'highlights' && item.type === 'career_highlight') ||
        (activeTab === 'overviews' && item.type === 'overview') ||
        (activeTab === 'bullets' && item.type === 'bullet');

      if (!typeMatch) return false;
      if (!search) return true;

      return (
        item.id.toLowerCase().includes(search) ||
        item.title?.toLowerCase().includes(search) ||
        item.contentLong?.toLowerCase().includes(search)
      );
    });
  }

  function getVariantsForItem(baseId: string) {
    if (!variants) return [];
    return variants.variants.filter(v => v.base_id === baseId);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg">Loading content...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-slate-900 text-white px-6 py-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Content Editor</h1>
            <p className="text-sm text-gray-400">Edit content and save to JSON files</p>
          </div>
          <div className="flex items-center gap-4">
            {hasChanges && (
              <span className="text-yellow-400 text-sm">Unsaved changes</span>
            )}
            <button
              onClick={() => saveFile('contentDatabase', contentDatabase)}
              disabled={saving || !hasChanges}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded text-sm font-medium"
            >
              {saving ? 'Saving...' : 'Save Content DB'}
            </button>
            <button
              onClick={() => saveFile('variants', variants)}
              disabled={saving || !hasChanges}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded text-sm font-medium"
            >
              Save Variants
            </button>
            <button
              onClick={() => saveFile('positionBulletVariants', positionBulletVariants)}
              disabled={saving || !hasChanges}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 rounded text-sm font-medium"
            >
              Save PB Variants
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="max-w-7xl mx-auto px-6 py-2">
          <div className="bg-red-100 text-red-700 px-4 py-2 rounded">{error}</div>
        </div>
      )}
      {success && (
        <div className="max-w-7xl mx-auto px-6 py-2">
          <div className="bg-green-100 text-green-700 px-4 py-2 rounded">{success}</div>
        </div>
      )}

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex gap-2 border-b border-gray-200 mb-4">
          {[
            { key: 'summaries', label: 'Summaries' },
            { key: 'highlights', label: 'Career Highlights' },
            { key: 'overviews', label: 'Overviews' },
            { key: 'bullets', label: 'Position Bullets' },
            { key: 'pbv', label: 'PB Variants (Not Seeded)' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search by ID, title, or content..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        {/* Content List */}
        {activeTab !== 'pbv' ? (
          <div className="space-y-4">
            {getFilteredItems().map(item => (
              <div key={item.id} className="bg-white rounded-lg shadow p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                      {item.id}
                    </span>
                    {item.position && (
                      <span className="text-xs bg-slate-900 text-white px-2 py-1 rounded">
                        P{item.position}
                      </span>
                    )}
                    <button
                      onClick={() => setEditingItem(editingItem === item.id ? null : item.id)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      {editingItem === item.id ? 'Close' : 'Edit'}
                    </button>
                  </div>
                </div>

                {/* Title */}
                <div className="mb-3">
                  <label className="block text-xs text-gray-500 mb-1">Title</label>
                  <input
                    type="text"
                    value={item.title || ''}
                    onChange={e => updateContentItem(item.id, 'title', e.target.value)}
                    className="w-full max-w-md px-3 py-2 border border-gray-300 rounded text-sm"
                    placeholder="Human-readable title"
                  />
                </div>

                {/* Content preview or full edit */}
                {editingItem === item.id ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Content Long</label>
                      <textarea
                        value={item.contentLong || ''}
                        onChange={e => updateContentItem(item.id, 'contentLong', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        rows={4}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Industry Tags (comma-separated)</label>
                        <input
                          type="text"
                          value={(item.industryTags || []).join(', ')}
                          onChange={e => updateContentItem(item.id, 'industryTags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Function Tags (comma-separated)</label>
                        <input
                          type="text"
                          value={(item.functionTags || []).join(', ')}
                          onChange={e => updateContentItem(item.id, 'functionTags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Theme Tags (comma-separated)</label>
                        <input
                          type="text"
                          value={(item.themeTags || []).join(', ')}
                          onChange={e => updateContentItem(item.id, 'themeTags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Exclusive Metrics (comma-separated)</label>
                        <input
                          type="text"
                          value={(item.exclusiveMetrics || []).join(', ')}
                          onChange={e => updateContentItem(item.id, 'exclusiveMetrics', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        />
                      </div>
                    </div>

                    {/* Variants for this item */}
                    {(item.type === 'career_highlight' || item.type === 'bullet') && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">
                          Variants ({getVariantsForItem(item.id).length})
                        </h4>
                        <div className="space-y-3">
                          {getVariantsForItem(item.id).map(v => (
                            <div key={v.id} className="bg-gray-50 p-3 rounded">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-mono text-xs">{v.id}</span>
                                <input
                                  type="text"
                                  value={v.variant_label}
                                  onChange={e => updateVariant(v.id, 'variant_label', e.target.value)}
                                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                                  placeholder="Variant label"
                                />
                              </div>
                              <textarea
                                value={v.content || ''}
                                onChange={e => updateVariant(v.id, 'content', e.target.value)}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                rows={2}
                                placeholder="Variant content"
                              />
                              <input
                                type="text"
                                value={(v.theme_tags || []).join(', ')}
                                onChange={e => updateVariant(v.id, 'theme_tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                                className="w-full mt-2 px-2 py-1 border border-gray-300 rounded text-sm"
                                placeholder="Theme tags (comma-separated)"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {item.contentLong || item.contentMedium || item.contentShort || 'No content'}
                  </p>
                )}

                {/* Tags display */}
                <div className="flex flex-wrap gap-1 mt-3">
                  {(item.industryTags || []).map(t => (
                    <span key={t} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{t}</span>
                  ))}
                  {(item.functionTags || []).map(t => (
                    <span key={t} className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">{t}</span>
                  ))}
                  {(item.themeTags || []).map(t => (
                    <span key={t} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Position Bullet Variants (Not Seeded) */
          <div className="space-y-6">
            {positionBulletVariants && Object.entries(positionBulletVariants.positionBulletVariants).map(([baseId, data]) => (
              <div key={baseId} className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className="font-mono text-sm bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                    {baseId}
                  </span>
                  <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                    → {data.correspondingCH}
                  </span>
                  <span className="text-xs bg-yellow-400 text-yellow-900 px-2 py-1 rounded font-medium">
                    NOT SEEDED
                  </span>
                </div>

                <p className="text-sm text-gray-600 mb-4">{data.base.contentLong}</p>

                <div className="space-y-3">
                  {data.variants.map(v => (
                    <div key={v.id} className="bg-gray-50 p-3 rounded border-l-4 border-yellow-400">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-mono text-xs">{v.id}</span>
                        <input
                          type="text"
                          value={v.variantLabel}
                          onChange={e => updatePBVariant(baseId, v.id, 'variantLabel', e.target.value)}
                          className="px-2 py-1 border border-gray-300 rounded text-sm font-medium"
                        />
                      </div>
                      <textarea
                        value={v.contentLong}
                        onChange={e => updatePBVariant(baseId, v.id, 'contentLong', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        rows={2}
                      />
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <input
                          type="text"
                          value={(v.themeTags || []).join(', ')}
                          onChange={e => updatePBVariant(baseId, v.id, 'themeTags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                          className="px-2 py-1 border border-gray-300 rounded text-xs"
                          placeholder="Theme tags"
                        />
                        <input
                          type="text"
                          value={(v.exclusiveMetrics || []).join(', ')}
                          onChange={e => updatePBVariant(baseId, v.id, 'exclusiveMetrics', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                          className="px-2 py-1 border border-gray-300 rounded text-xs"
                          placeholder="Metrics"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
