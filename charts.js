/* ============================================================================
 * charts.js — thin theme-aware wrapper over Chart.js + small viz builders
 * ==========================================================================*/
(function () {
  'use strict';
  const registry = {};                 // canvasId -> Chart instance

  function tokens() {
    const cs = getComputedStyle(document.documentElement);
    const g = (v) => cs.getPropertyValue(v).trim();
    return {
      txt: g('--txt'), muted: g('--muted'), line: g('--line-soft'),
      acc: g('--acc'), acc2: g('--acc2'), vio: g('--vio'), amber: g('--amber'),
      red: g('--red'), green: g('--green'), orange: g('--orange'),
      panel: g('--panel'), panel3: g('--panel3')
    };
  }
  const PAL = ['#a94df5', '#ff4d9e', '#c084fc', '#fbbf24', '#fb923c', '#2fd48a', '#ff5d7e', '#e879f9', '#a3e635', '#7c9cff'];

  function applyDefaults() {
    if (!window.Chart) return;
    const t = tokens();
    Chart.defaults.font.family = '"Segoe UI", Inter, system-ui, -apple-system, Roboto, Arial, sans-serif';
    Chart.defaults.font.size = 11;
    Chart.defaults.color = t.muted;
    Chart.defaults.borderColor = t.line;
    Chart.defaults.plugins.legend.labels.boxWidth = 11;
    Chart.defaults.plugins.legend.labels.boxHeight = 11;
    Chart.defaults.plugins.legend.labels.padding = 14;
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(10,14,30,.94)';
    Chart.defaults.plugins.tooltip.titleColor = '#e9edf9';
    Chart.defaults.plugins.tooltip.bodyColor = '#c6cde8';
    Chart.defaults.plugins.tooltip.borderColor = '#2a3560';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.animation.duration = 420;
  }

  function destroy(id) {
    if (registry[id]) { registry[id].destroy(); delete registry[id]; }
  }
  function destroyAll() { Object.keys(registry).forEach(destroy); }

  function mk(id, cfg) {
    const el = document.getElementById(id);
    if (!el) return null;
    destroy(id);
    registry[id] = new Chart(el.getContext('2d'), cfg);
    return registry[id];
  }

  function grad(id, hex, a1, a2) {
    const el = document.getElementById(id);
    if (!el) return hex;
    const ctx = el.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, el.parentNode.clientHeight || 240);
    g.addColorStop(0, hex + (a1 || '33'));
    g.addColorStop(1, hex + (a2 || '03'));
    return g;
  }

  /* standard option blocks ------------------------------------------------ */
  function axesOpts(o) {
    o = o || {};
    const t = tokens();
    return {
      x: {
        grid: { display: !!o.xGrid, color: t.line }, ticks: { maxRotation: o.xRot == null ? 0 : o.xRot, autoSkip: true, maxTicksLimit: o.xTicks || 12 },
        stacked: !!o.stacked, title: o.xTitle ? { display: true, text: o.xTitle } : undefined
      },
      y: {
        grid: { color: t.line }, beginAtZero: true, stacked: !!o.stacked,
        ticks: { callback: o.yFmt, maxTicksLimit: 7 },
        title: o.yTitle ? { display: true, text: o.yTitle } : undefined
      },
      y2: o.y2 ? {
        position: 'right', grid: { display: false }, beginAtZero: true,
        ticks: { callback: o.y2Fmt, maxTicksLimit: 7 }
      } : undefined
    };
  }

  function line(id, labels, datasets, o) {
    o = o || {};
    applyDefaults();
    datasets.forEach((d, i) => {
      if (d.borderColor == null) d.borderColor = PAL[i % PAL.length];
      if (d.fill) d.backgroundColor = grad(id, d.borderColor, '30', '02');
      if (d.tension == null) d.tension = 0.35;
      if (d.pointRadius == null) d.pointRadius = 0;
      if (d.borderWidth == null) d.borderWidth = 2;
    });
    return mk(id, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true, interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: o.legend !== false && datasets.length > 1 },
          tooltip: { callbacks: o.tt || {} }
        },
        scales: axesOpts(o)
      }
    });
  }

  function bar(id, labels, datasets, o) {
    o = o || {};
    applyDefaults();
    datasets.forEach((d, i) => {
      if (d.backgroundColor == null) d.backgroundColor = PAL[i % PAL.length];
      if (d.borderRadius == null) d.borderRadius = 6;
      if (d.maxBarThickness == null) d.maxBarThickness = 34;
    });
    return mk(id, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true, indexAxis: o.h ? 'y' : 'x',
        plugins: { legend: { display: o.legend === true || (o.legend !== false && datasets.length > 1) }, tooltip: { callbacks: o.tt || {} } },
        scales: axesOpts(o)
      }
    });
  }

  function dough(id, labels, values, o) {
    o = o || {};
    applyDefaults();
    mk(id, {
      type: 'doughnut',
      data: { labels, datasets: [{ data: values, backgroundColor: o.colors || PAL.slice(0, labels.length), borderWidth: 2, borderColor: tokens().panel, hoverOffset: 6 }] },
      options: {
        responsive: true, cutout: o.cutout || '68%',
        plugins: {
          legend: { display: o.legend !== false, position: o.legendPos || 'right' },
          tooltip: { callbacks: o.tt || {} }
        }
      },
      plugins: o.center ? [{
        id: 'ctr' + id,
        afterDraw(c) {
          const m = c.getDatasetMeta(0); if (!m.data[0]) return;
          const { x, y } = m.data[0];
          const ctx = c.ctx;
          ctx.save();
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = tokens().txt; ctx.font = '700 21px "Segoe UI", sans-serif';
          ctx.fillText(o.center[0], x, y - 7);
          ctx.fillStyle = tokens().muted; ctx.font = '600 10px "Segoe UI", sans-serif';
          ctx.fillText(o.center[1], x, y + 13);
          ctx.restore();
        }
      }] : []
    });
  }

  /* heatmap (HTML grid) ---------------------------------------------------- */
  // matrix[r][c], heatColor maps normalized 0..1 -> css color for scale [from->to]
  function heatColor(t, stops) {
    // stops: array of [r,g,b]; interpolate
    t = Math.max(0, Math.min(1, t || 0));
    const seg = stops.length - 1;
    const x = t * seg, i = Math.min(seg - 1, Math.floor(x)), f = x - i;
    const a = stops[i], b = stops[i + 1];
    const c = a.map((v, k) => Math.round(v + (b[k] - v) * f));
    return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
  }
  const HEAT_BLUE = [[26, 16, 48], [74, 30, 128], [149, 14, 219], [255, 77, 205]];
  const HEAT_RED = [[26, 16, 48], [120, 49, 80], [214, 69, 99], [255, 122, 96]];
  const HEAT_GREEN = [[26, 16, 48], [24, 94, 73], [47, 212, 138], [158, 240, 190]];

  function heatmap(opts) {
    // opts: {rows, cols, cells[r][c] = {v, text?}, stops, fmt, rowPad, onClick}
    const fmt = opts.fmt || ((v) => v);
    let min = Infinity, max = -Infinity;
    opts.cells.forEach(r => r.forEach(c => {
      if (c && c.v != null && isFinite(c.v)) { if (c.v < min) min = c.v; if (c.v > max) max = c.v; }
    }));
    if (!isFinite(min)) { min = 0; max = 1; }
    if (min === max) max = min + 1;
    let h = '<table class="heat"><tr><th></th>';
    opts.cols.forEach(c => h += '<th>' + c + '</th>');
    h += '</tr>';
    opts.rows.forEach((rn, r) => {
      h += '<tr><th class="row">' + rn + '</th>';
      opts.cols.forEach((cn, c) => {
        const cell = opts.cells[r][c] || {};
        if (cell.v == null) { h += '<td style="background:var(--panel3);opacity:.35"></td>'; return; }
        const t = (cell.v - min) / (max - min);
        const bg = heatColor(t, opts.stops || HEAT_BLUE);
        const click = opts.onClick ? ' data-r="' + r + '" data-c="' + c + '" style="cursor:pointer;background:' + bg + '"' : ' style="background:' + bg + '"';
        h += '<td' + click + ' title="' + (cell.tip || (rn + ' · ' + cn + ': ' + fmt(cell.v))) + '">' + (cell.text != null ? cell.text : (t > .55 ? fmt(cell.v) : '')) + '</td>';
      });
      h += '</tr>';
    });
    h += '</table>';
    h += '<div class="heat-legend"><span>Low</span><div class="bar" style="background:linear-gradient(90deg,' +
      heatColor(0, opts.stops || HEAT_BLUE) + ',' + heatColor(.5, opts.stops || HEAT_BLUE) + ',' + heatColor(1, opts.stops || HEAT_BLUE) + ')"></div><span>High</span><span style="margin-left:auto">' + fmt(min) + ' – ' + fmt(max) + '</span></div>';
    return h;
  }

  window.CH = { mk, destroy, destroyAll, applyDefaults, tokens, line, bar, dough, heatmap, PAL, HEAT_BLUE, HEAT_RED, HEAT_GREEN, grad };
  applyDefaults();
})();
