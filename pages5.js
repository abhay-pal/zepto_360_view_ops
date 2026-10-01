/* ============================================================================
 * pages5.js — Download Center: per-dataset CSV / Excel exports + the full
 * multi-worksheet "all data" workbook.
 * ==========================================================================*/
(function () {
  'use strict';
  const A = window.APP, DB = A.DB, E = window.EXPORTS;
  const { fmtN } = A;
  const el = (id) => document.getElementById(id);

  const stamp = () => {
    const d = new Date();
    return d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2);
  };
  const COUNTERS = {
    orders_scope: (ctx) => ctx.cur.length,
    orders_full: () => DB.orders.length,
    sla_breaches: (ctx) => ctx.k.slaB,
    cancellations: (ctx) => ctx.cur.reduce((a, o) => a + (o.status === 1 || o.ref > 0 ? 1 : 0), 0),
    customers: () => DB.customers.length,
    riders: () => DB.riders.length,
    stores: () => DB.stores.length,
    cities: () => DB.cities.length,
    categories: () => DB.cats.length,
    skus: () => DB.skus.length,
    stockouts: (ctx) => ctx.soL.length,
    complaints: (ctx) => ctx.cmpL.length,
    store_summary: (ctx) => ctx.byStore.size,
    daily_summary: (ctx) => ctx.len
  };
  const SCOPE_TAGGED = new Set(['orders_scope', 'sla_breaches', 'cancellations', 'stockouts', 'complaints', 'store_summary', 'daily_summary']);

  PAGES.download = function (ctx) {
    const keys = Object.keys(E.DATASETS);
    el('page-download').innerHTML =
      /* ---------------- hero: full workbook ---------------- */
      '<div class="panel dl-hero">' +
      '<div class="dl-hero-L">' +
      '<div class="dl-hero-ic">⬇</div>' +
      '<div><h3 style="font-size:17px">Download ALL data — one Excel workbook</h3>' +
      '<div class="psub" style="margin:4px 0 0">14 worksheets in a single <b>.xlsx</b>: README · Orders (full 12 months, ' + fmtN(DB.orders.length) + ' rows) · SLA Breaches · Cancellations · Stock-outs · Complaints · Customers · Riders · Dark Stores · Cities · Categories · SKUs · Store Summary · Daily Summary.' +
      '<br>Built entirely in your browser (no server) · ≈ 10 MB · takes a few seconds · works in Excel, Google Sheets &amp; LibreOffice.</div>' +
      '<div class="dl-status" id="dlAllStatus"></div></div>' +
      '</div>' +
      '<button class="dl-btn-big" id="dlAllBtn">⬇&nbsp; Download Workbook (.xlsx)</button>' +
      '</div>' +

      '<div class="panel" style="margin-top:14px"><h3>📦 Export by dataset</h3>' +
      '<div class="psub">Datasets tagged <span class="tag" style="color:var(--acc2)">scope</span> respect your current global filters （' +
      A.rangeLabel(ctx.from, ctx.to) + '）— reference masters are always complete. CSV opens directly in Excel.</div>' +
      '<div class="dl-grid" style="margin-top:12px">' +
      keys.map(k => {
        const ds = E.DATASETS[k];
        const cnt = COUNTERS[k] ? COUNTERS[k](ctx) : null;
        return '<div class="dl-card" data-dscard="' + k + '">' +
          '<div class="dl-card-head"><span class="dl-ic">' + ds.icon + '</span><div><b>' + ds.title + '</b><div class="muted small">' + fmtN(cnt) + ' rows · ' + ds.headers.length + ' columns' + (SCOPE_TAGGED.has(k) ? ' · <span style="color:var(--acc2)">scope</span>' : ' · full') + '</div></div></div>' +
          '<div class="muted small" style="margin:7px 0 10px;line-height:1.45">' + ds.desc + '</div>' +
          '<div class="flex" style="gap:7px">' +
          '<button class="dl-btn" data-ds="' + k + '" data-type="csv">⬇ CSV</button>' +
          '<button class="dl-btn alt" data-ds="' + k + '" data-type="xlsx">⬇ Excel</button>' +
          '<span class="dl-mini-status" id="st_' + k + '"></span>' +
          '</div></div>';
      }).join('') + '</div></div>' +

      '<div class="panel" style="margin-top:14px"><h3>ℹ About the exports</h3>' +
      '<div class="muted small" style="line-height:1.6">Every file embeds the synthetic-data disclaimer. Times are in minutes from order placement (accept / picking / packing / rider-assign / rider-wait / last-mile / total order-to-delivery). ' +
      'SLA breach = delivered beyond ' + DB.slaMin + ' minutes. Negative timestamps (steps not reached for cancelled orders) are exported as blanks. ' +
      'Every rendered table across the dashboard also carries an <b>⬇ Export table</b> button right above it.</div></div>';

    /* ------------------------- wire hero button ------------------------- */
    el('dlAllBtn').addEventListener('click', async () => {
      const btn = el('dlAllBtn'), st = el('dlAllStatus');
      btn.disabled = true; btn.classList.add('busy');
      st.textContent = '⏳ Assembling ' + fmtN(DB.orders.length) + ' orders + 13 more sheets… keep this tab open';
      await new Promise(r => setTimeout(r, 60));
      try {
        const t0 = performance.now();
        const size = await E.exportWorkbook('ZeptoOps360_FullDataset_' + stamp(), E.fullWorkbookSheets(ctx));
        st.innerHTML = '✅ Done — ' + (size / 1048576).toFixed(1) + ' MB workbook downloaded (' + ((performance.now() - t0) / 1000).toFixed(1) + ' s)';
      } catch (err) {
        console.error(err);
        st.textContent = '❌ Export failed: ' + err.message;
      }
      btn.disabled = false; btn.classList.remove('busy');
    });

    /* ----------------------- wire per-dataset buttons ----------------------- */
    el('page-download').querySelectorAll('button[data-ds]').forEach(btn => btn.addEventListener('click', async () => {
      const k = btn.dataset.ds, type = btn.dataset.type, ds = E.DATASETS[k];
      const st = el('st_' + k);
      btn.disabled = true; st.textContent = '⏳';
      await new Promise(r => setTimeout(r, 40));
      try {
        const rows = ds.getRows(ctx);
        const fname = 'ZeptoOps360_' + k.replace(/_/g, '-') + (SCOPE_TAGGED.has(k) ? '_' + ctx.f.preset : '') + '_' + stamp();
        if (type === 'csv') { E.exportCSV(fname, ds.headers, rows); }
        else { await E.exportWorkbook(fname, [{ name: ds.title, headers: ds.headers, rows }]); }
        st.textContent = '✅ ' + fmtN(rows.length) + ' rows';
      } catch (err) {
        console.error(err); st.textContent = '❌ ' + err.message;
      }
      btn.disabled = false;
      setTimeout(() => { if (st.textContent.startsWith('✅')) st.textContent = ''; }, 6000);
    }));
  };
})();
