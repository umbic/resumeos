const fs = require('fs');
const path = require('path');

// Read the export data
const exportData = JSON.parse(fs.readFileSync(path.join(__dirname, '../CONTENT_LIBRARY_EXPORT.json'), 'utf8'));

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ResumeOS Content Library</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; color: #333; }
    .header { background: #1a1a2e; color: white; padding: 20px 40px; position: sticky; top: 0; z-index: 100; }
    .header h1 { font-size: 24px; margin-bottom: 8px; }
    .header .stats { display: flex; gap: 20px; font-size: 14px; opacity: 0.8; }
    .header .stats span { background: rgba(255,255,255,0.1); padding: 4px 12px; border-radius: 4px; }
    .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
    .filters { background: white; padding: 16px 20px; border-radius: 8px; margin-bottom: 20px; display: flex; gap: 12px; flex-wrap: wrap; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .filters label { font-size: 13px; font-weight: 600; color: #666; }
    .filters select, .filters input { padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; }
    .filters select { min-width: 150px; }
    .filters input[type="text"] { flex: 1; min-width: 200px; }
    .section { background: white; border-radius: 8px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }
    .section-header { padding: 16px 20px; background: #f8f9fa; border-bottom: 1px solid #eee; cursor: pointer; display: flex; justify-content: space-between; align-items: center; }
    .section-header:hover { background: #f0f0f0; }
    .section-header h2 { font-size: 16px; display: flex; align-items: center; gap: 10px; }
    .section-header .count { background: #e0e0e0; padding: 2px 8px; border-radius: 10px; font-size: 12px; font-weight: normal; }
    .section-header .arrow { transition: transform 0.2s; }
    .section-header.collapsed .arrow { transform: rotate(-90deg); }
    .section-content { padding: 0; }
    .section-content.hidden { display: none; }
    .item { border-bottom: 1px solid #f0f0f0; padding: 16px 20px; }
    .item:last-child { border-bottom: none; }
    .item:hover { background: #fafafa; }
    .item-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
    .item-id { font-weight: 600; color: #1a1a2e; font-family: monospace; font-size: 14px; }
    .item-title { font-weight: 600; color: #333; margin-left: 12px; font-size: 14px; }
    .item-label { font-size: 12px; color: #666; background: #f0f0f0; padding: 2px 8px; border-radius: 4px; }
    .item-content { font-size: 14px; color: #444; line-height: 1.5; margin-bottom: 10px; }
    .item-tags { display: flex; flex-wrap: wrap; gap: 6px; }
    .tag { font-size: 11px; padding: 3px 8px; border-radius: 4px; }
    .tag.industry { background: #e3f2fd; color: #1565c0; }
    .tag.function { background: #f3e5f5; color: #7b1fa2; }
    .tag.theme { background: #e8f5e9; color: #2e7d32; }
    .tag.metric { background: #fff3e0; color: #e65100; }
    .variants-toggle { font-size: 12px; color: #1976d2; cursor: pointer; margin-top: 10px; }
    .variants-toggle:hover { text-decoration: underline; }
    .variants-list { margin-top: 10px; padding-left: 20px; border-left: 3px solid #e0e0e0; }
    .variant-item { padding: 10px 0; border-bottom: 1px dashed #eee; }
    .variant-item:last-child { border-bottom: none; }
    .variant-id { font-family: monospace; font-size: 13px; color: #555; }
    .variant-label { font-weight: 500; color: #333; margin-left: 8px; }
    .variant-title { font-size: 12px; color: #666; margin-left: 8px; }
    .variant-content { font-size: 13px; color: #555; margin-top: 6px; line-height: 1.4; background: #f9f9f9; padding: 8px; border-radius: 4px; }
    .not-seeded-badge { font-size: 10px; background: #ffeb3b; color: #333; padding: 2px 6px; border-radius: 3px; margin-left: 8px; font-weight: 500; }
    .hidden { display: none !important; }
    .no-results { text-align: center; padding: 40px; color: #999; }
    .position-badge { background: #1a1a2e; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-left: 8px; }
    .summary-bar { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin-bottom: 20px; }
    .summary-card { background: white; padding: 16px; border-radius: 8px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .summary-card .number { font-size: 28px; font-weight: 700; color: #1a1a2e; }
    .summary-card .label { font-size: 12px; color: #666; margin-top: 4px; }
    .tag-legend { display: flex; gap: 16px; margin-top: 12px; font-size: 12px; }
    .tag-legend span { display: flex; align-items: center; gap: 4px; }
    .tag-legend .dot { width: 10px; height: 10px; border-radius: 50%; }
    .dot.industry { background: #1565c0; }
    .dot.function { background: #7b1fa2; }
    .dot.theme { background: #2e7d32; }
    .dot.metric { background: #e65100; }
  </style>
</head>
<body>
  <div class="header">
    <h1>ResumeOS Content Library</h1>
    <div class="stats">
      <span id="totalCount">Loading...</span>
      <span id="filteredCount"></span>
    </div>
    <div class="tag-legend">
      <span><span class="dot industry"></span> Industry</span>
      <span><span class="dot function"></span> Function</span>
      <span><span class="dot theme"></span> Theme</span>
      <span><span class="dot metric"></span> Metric</span>
    </div>
  </div>

  <div class="container">
    <div class="summary-bar" id="summaryBar"></div>

    <div class="filters">
      <label>Type:</label>
      <select id="filterType">
        <option value="all">All Types</option>
        <option value="summary">Summaries</option>
        <option value="career_highlight">Career Highlights</option>
        <option value="overview">Overviews</option>
        <option value="bullet">Bullets</option>
      </select>

      <label>Position:</label>
      <select id="filterPosition">
        <option value="all">All Positions</option>
        <option value="1">P1 - Deloitte SVP</option>
        <option value="2">P2 - Deloitte Sr. Dir</option>
        <option value="3">P3 - Omnicom VP</option>
        <option value="4">P4 - OMD Head</option>
        <option value="5">P5 - Straightline</option>
        <option value="6">P6 - Berlin Cameron</option>
      </select>

      <label>Search:</label>
      <input type="text" id="searchInput" placeholder="Search content, tags, IDs, titles...">
    </div>

    <div id="content"></div>
  </div>

  <script>
    // Embed the data directly
    const data = ${JSON.stringify(exportData, null, 2)};

    let allItems = [];

    function init() {
      // Build flat list of all items

      // Summaries
      data.summaries.items.forEach(item => {
        allItems.push({
          ...item,
          type: 'summary',
          position: null,
          content: item.contentPreview,
          variants: []
        });
      });

      // Career Highlights
      data.careerHighlights.items.forEach(item => {
        allItems.push({
          id: item.baseId,
          title: item.title,
          type: 'career_highlight',
          position: null,
          content: item.baseContent,
          functionTags: item.functionTags || [],
          industryTags: [],
          themeTags: [],
          variants: item.variants || [],
          variantCount: item.variantCount
        });
      });

      // Overviews
      data.overviews.items.forEach(item => {
        allItems.push({
          id: item.baseId,
          title: item.title,
          type: 'overview',
          position: item.position,
          content: item.baseContent,
          functionTags: [],
          industryTags: [],
          themeTags: [],
          variants: item.variants || [],
          variantCount: item.variantCount
        });
      });

      // Position Bullets
      Object.entries(data.positionBullets.positions).forEach(([posKey, posData]) => {
        posData.bullets.forEach(bullet => {
          allItems.push({
            id: bullet.baseId,
            title: bullet.title,
            type: 'bullet',
            position: posData.positionNumber,
            content: bullet.baseContent,
            functionTags: bullet.functionTags || [],
            industryTags: [],
            themeTags: [],
            exclusiveMetrics: bullet.exclusiveMetrics || [],
            variants: bullet.variants || [],
            variantCount: bullet.variantCount
          });
        });
      });

      // Update stats
      document.getElementById('totalCount').textContent = \`\${allItems.length} base items + variants\`;

      // Build summary bar
      buildSummaryBar();

      // Initial render
      render();

      // Event listeners
      document.getElementById('filterType').addEventListener('change', render);
      document.getElementById('filterPosition').addEventListener('change', render);
      document.getElementById('searchInput').addEventListener('input', render);
    }

    function buildSummaryBar() {
      const counts = {
        'Summaries': data.summaries.count,
        'Career Highlights': data.careerHighlights.baseCount,
        'CH Variants': data.careerHighlights.variantCount,
        'Overviews': data.overviews.baseCount,
        'OV Variants': data.overviews.variantCount,
        'P1 Bullets': data.positionBullets.summary.P1.bases,
        'P2 Bullets': data.positionBullets.summary.P2.bases,
        'Bullet Variants': Object.values(data.positionBullets.summary).reduce((a, b) => a + b.variants, 0)
      };

      const html = Object.entries(counts).map(([label, count]) => \`
        <div class="summary-card">
          <div class="number">\${count}</div>
          <div class="label">\${label}</div>
        </div>
      \`).join('');

      document.getElementById('summaryBar').innerHTML = html;
    }

    function render() {
      const typeFilter = document.getElementById('filterType').value;
      const posFilter = document.getElementById('filterPosition').value;
      const search = document.getElementById('searchInput').value.toLowerCase();

      let filtered = allItems.filter(item => {
        if (typeFilter !== 'all' && item.type !== typeFilter) return false;
        if (posFilter !== 'all' && item.position !== parseInt(posFilter)) return false;
        if (search) {
          const searchIn = [
            item.id,
            item.title || '',
            item.content,
            ...(item.functionTags || []),
            ...(item.industryTags || []),
            ...(item.themeTags || []),
            ...(item.exclusiveMetrics || []),
            ...(item.variants || []).map(v => v.label + ' ' + v.id + ' ' + (v.title || '') + ' ' + (v.themeTags || []).join(' '))
          ].join(' ').toLowerCase();
          if (!searchIn.includes(search)) return false;
        }
        return true;
      });

      document.getElementById('filteredCount').textContent = \`Showing \${filtered.length} items\`;

      if (filtered.length === 0) {
        document.getElementById('content').innerHTML = '<div class="no-results">No items match your filters</div>';
        return;
      }

      // Group by type
      const grouped = {};
      filtered.forEach(item => {
        const key = item.type === 'bullet' ? \`bullet_\${item.position}\` : item.type;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(item);
      });

      const typeLabels = {
        'summary': 'Summaries',
        'career_highlight': 'Career Highlights',
        'overview': 'Overviews',
        'bullet_1': 'Position 1 Bullets (Deloitte Digital - SVP)',
        'bullet_2': 'Position 2 Bullets (Deloitte Digital - Sr. Director)',
        'bullet_3': 'Position 3 Bullets (Omnicom Media Group)',
        'bullet_4': 'Position 4 Bullets (OMD Worldwide)',
        'bullet_5': 'Position 5 Bullets (Straightline)',
        'bullet_6': 'Position 6 Bullets (Berlin Cameron)'
      };

      const order = ['summary', 'career_highlight', 'overview', 'bullet_1', 'bullet_2', 'bullet_3', 'bullet_4', 'bullet_5', 'bullet_6'];

      let html = '';
      order.forEach(key => {
        if (!grouped[key]) return;
        const items = grouped[key];
        html += \`
          <div class="section">
            <div class="section-header" onclick="toggleSection(this)">
              <h2>\${typeLabels[key]} <span class="count">\${items.length}</span></h2>
              <span class="arrow">▼</span>
            </div>
            <div class="section-content">
              \${items.map(renderItem).join('')}
            </div>
          </div>
        \`;
      });

      document.getElementById('content').innerHTML = html;
    }

    function renderItem(item) {
      const tags = [];
      (item.industryTags || []).forEach(t => tags.push(\`<span class="tag industry">\${t}</span>\`));
      (item.functionTags || []).forEach(t => tags.push(\`<span class="tag function">\${t}</span>\`));
      (item.themeTags || []).forEach(t => tags.push(\`<span class="tag theme">\${t}</span>\`));
      (item.exclusiveMetrics || []).forEach(t => tags.push(\`<span class="tag metric">\${t}</span>\`));

      const variantsHtml = item.variants && item.variants.length > 0 ? \`
        <div class="variants-toggle" onclick="toggleVariants(this)">
          ▶ Show \${item.variants.length} variants
        </div>
        <div class="variants-list hidden">
          \${item.variants.map(v => \`
            <div class="variant-item">
              <span class="variant-id">\${v.id}</span>
              <span class="variant-label">\${v.label || ''}</span>
              \${v.title ? \`<span class="variant-title">(\${v.title})</span>\` : ''}
              \${v.notSeeded ? '<span class="not-seeded-badge">NOT SEEDED</span>' : ''}
              \${v.content ? \`<div class="variant-content">\${v.content}</div>\` : ''}
              <div class="item-tags" style="margin-top: 6px;">
                \${(v.industryTags || []).map(t => \`<span class="tag industry">\${t}</span>\`).join('')}
                \${(v.functionTags || []).map(t => \`<span class="tag function">\${t}</span>\`).join('')}
                \${(v.themeTags || []).map(t => \`<span class="tag theme">\${t}</span>\`).join('')}
                \${(v.exclusiveMetrics || []).map(t => \`<span class="tag metric">\${t}</span>\`).join('')}
              </div>
            </div>
          \`).join('')}
        </div>
      \` : '';

      const titleHtml = item.title ? \`<span class="item-title">\${item.title}</span>\` : '';

      return \`
        <div class="item">
          <div class="item-header">
            <div>
              <span class="item-id">\${item.id}</span>
              \${titleHtml}
            </div>
            \${item.variantCount ? \`<span class="item-label">\${item.variantCount} variants</span>\` : ''}
          </div>
          <div class="item-content">\${item.content || ''}</div>
          <div class="item-tags">\${tags.join('')}</div>
          \${variantsHtml}
        </div>
      \`;
    }

    function toggleSection(header) {
      header.classList.toggle('collapsed');
      header.nextElementSibling.classList.toggle('hidden');
    }

    function toggleVariants(toggle) {
      const list = toggle.nextElementSibling;
      list.classList.toggle('hidden');
      toggle.textContent = list.classList.contains('hidden')
        ? toggle.textContent.replace('▼ Hide', '▶ Show')
        : toggle.textContent.replace('▶ Show', '▼ Hide');
    }

    init();
  </script>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, '../content-viewer.html'), html);
console.log('Generated content-viewer.html with titles!');
