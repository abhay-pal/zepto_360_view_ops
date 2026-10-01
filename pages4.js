/* ============================================================================
 * pages4.js — Financial & Operational Efficiency · Exceptions Center ·
 * Director Insights · Action Center
 * ==========================================================================*/
(function () {
  'use strict';
  const A = window.APP, DB = A.DB;
  const { fmtM, fmtN, fmtMin, pct1, fx } = A;
  const el = (id) => document.getElementById(id);

  const GROSS_MARGIN = 0.225;   // blended merchandise margin (industry-typical)

  /* ===================== 13. FINANCIAL EFFICIENCY ========================= */
  function storeCostSet(ctx) {
    return DB.stores.filter(s =>
      (ctx.f.city === 'all' || s.city === +ctx.f.city) &&
      (ctx.f.zone === 'all' || (s.city === +ctx.f.city && s.zone === +ctx.f.zone)) &&
      (ctx.f.store === 'all' || s.id === +ctx.f.store));
  }
  PAGES.finance = function (ctx) {
    const k = ctx.k, d = ctx.d, len = ctx.len;
    const served = k.del + k.ref + k.ret;
    // delivery (rider) cost: ₹28 base + ₹6/km for each served order
    const riderCost = ctx.cur.reduce((a, o) => a + ((o.status === 0 || o.status === 2 || o.status === 3) ? 28 + 6 * o.dist : 0), 0);
    const packCost = k.n * 7;
    const stores = storeCostSet(ctx);
    const labor = stores.reduce((a, s) => a + (s.pickers * 21000 + s.packers * 19000 + s.staff * 18000), 0) * len / 30.4;
    const rent = stores.reduce((a, s) => a + s.rentL * 100000, 0) * len / 30.4;
    const tech = k.n * 8 + k.rev * 0.02;
    const refundCost = k.refAmt;
    const cancLoss = ctx.cur.reduce((a, o) => a + (o.status === 1 ? o.val : 0), 0);
    const soLoss = ctx.soLost;
    const gMargin = k.rev * GROSS_MARGIN;
    const opsCost = riderCost + packCost + labor + rent + tech;
    const contribution = gMargin - opsCost - refundCost;
    const cpo = opsCost / Math.max(1, k.n);
    const cMargin = k.rev ? 100 * contribution / k.rev : 0;

    // waterfall pairs
    const steps = [];
    let acc = 0;
    const push = (lbl, v, kind) => { const from = kind === 'abs' ? 0 : acc; acc = kind === 'abs' ? v : acc + v; steps.push({ lbl, lo: v >= 0 ? from : acc, hi: v >= 0 ? acc : from, v, kind }); };
    push('GMV', k.gmv, 'abs');
    push('Discounts', -k.disc);
    push('Delivery fees', k.fee);
    push('Merch. cost', -k.rev * (1 - GROSS_MARGIN));
    push('Rider payouts', -riderCost);
    push('Packaging', -packCost);
    push('Store labor', -labor);
    push('Rent', -rent);
    push('Tech & support', -tech);
    push('Refunds', -refundCost);
    const wfLabels = steps.map(s => s.lbl);
    const wfData = steps.map(s => [fx(s.lo / 1e5, 2), fx(s.hi / 1e5, 2)]);
    const wfColor = steps.map(s => s.kind === 'abs' ? '#a94df5' : s.v >= 0 ? '#2fd48a' : '#ff5d7e');

    // city P&L
    const cityRows = DB.cities.map((c, ci) => {
      const a = ctx.byCity.get(ci); if (!a || !a.n) return null;
      const cStores = DB.stores.filter(s => s.city === ci);
      const rc = riderCost * a.n / Math.max(1, k.n);
      const lab = cStores.reduce((z, s) => z + (s.pickers * 21000 + s.packers * 19000 + s.staff * 18000), 0) * len / 30.4;
      const rnt = cStores.reduce((z, s) => z + s.rentL * 100000, 0) * len / 30.4;
      const gm = a.rev * GROSS_MARGIN;
      const ocost = rc + a.n * 7 + lab + rnt + a.n * 8 + a.rev * 0.02;
      const contr = gm - ocost - a.refAmt;
      return { c, a, ocost, contr, cpo: ocost / a.n, m: 100 * contr / Math.max(1, a.rev) };
    }).filter(Boolean);

    // daily revenue vs cost
    const lab2 = [], revT = [], costT = [];
    for (let day = ctx.from; day <= ctx.to; day++) {
      const a = ctx.byDay.get(day);
      lab2.push(DB.days[day].label);
      revT.push(a ? fx(a.rev / 1000, 1) : 0);
      costT.push(a ? fx(((a.del + a.ref + a.ret) * 40 + a.n * 7 + a.refAmt) / 1000, 1) : 0);
    }

    el('page-finance').innerHTML =
      A.kpiGrid([
        A.kpiHTML({ label: 'GMV', cur: k.gmv, prev: ctx.hasPrev ? ctx.pk.gmv : null, fmt: fmtM, color: 'var(--vio)' }),
        A.kpiHTML({ label: 'Net Revenue', cur: k.rev, prev: ctx.hasPrev ? ctx.pk.rev : null, fmt: fmtM, color: 'var(--acc2)' }),
        A.kpiHTML({ label: 'Contribution (ops)', cur: contribution, fmt: fmtM, color: contribution >= 0 ? 'var(--green)' : 'var(--red)' }),
        A.kpiHTML({ label: 'Contribution / Order', cur: contribution / Math.max(1, served), prev: null, fmt: v => '₹' + fx(v, 0), color: contribution >= 0 ? 'var(--green)' : 'var(--red)' }),
        A.kpiHTML({ label: 'Discount Cost', cur: k.disc, prev: ctx.hasPrev ? ctx.pk.disc : null, fmt: fmtM, invert: true, color: 'var(--orange)' }),
        A.kpiHTML({ label: 'Delivery (Rider) Cost', cur: riderCost, fmt: fmtM, invert: true, color: 'var(--acc)' }),
        A.kpiHTML({ label: 'Refund Cost', cur: refundCost, prev: ctx.hasPrev ? ctx.pk.refAmt : null, fmt: fmtM, invert: true, color: 'var(--red)' }),
        A.kpiHTML({ label: 'Cancellation Loss', cur: cancLoss, fmt: fmtM, invert: true, color: 'var(--red)' }),
        A.kpiHTML({ label: 'Stock-out Loss (est.)', cur: soLoss, fmt: fmtM, invert: true, color: 'var(--amber)' }),
        A.kpiHTML({ label: 'Ops Cost / Order', cur: cpo, fmt: v => '₹' + fx(v, 0), invert: true, target: 78, tFmt: v => '₹' + v, ach: 100 * 78 / Math.max(.01, cpo), color: cpo <= 85 ? 'var(--green)' : 'var(--red)' }),
        A.kpiHTML({ label: 'Revenue / Store', cur: k.rev / Math.max(1, k.stores.size), fmt: fmtM, color: 'var(--acc)' }),
        A.kpiHTML({ label: 'Revenue / Rider', cur: k.rev / Math.max(1, k.riders.size), fmt: v => '₹' + fmtN(v), color: 'var(--acc2)' })
      ]) +
      '<div class="grid g32">' +
      '<div class="panel"><h3>GMV → operational contribution waterfall (₹ lakh)</h3><div class="psub">where money is earned vs burned across the period · merchandise margin assumed at industry-blended 22.5%</div>' +
      '<div class="chart-wrap" style="height:300px"><canvas id="fnWf"></canvas></div></div>' +
      '<div class="panel"><h3>Efficiency leakage</h3><div class="psub">what operational issues cost this period</div>' +
      '<div style="display:flex;flex-direction:column;gap:9px;margin-top:6px">' +
      leak('Cancellations', cancLoss, 'fix stock-outs & store response') +
      leak('Refunds', refundCost, 'improve picking QC & packaging') +
      leak('Stock-out lost sales', soLoss, 'tighten replenishment cycles') +
      leak('SLA breach exposure', ctx.k.slaB * d.aov * 0.12, 'assumes 12% churned-value risk') +
      '</div>' +
      '<div class="sec-title">Where the money leaks</div>' +
      '<div class="att-action">💡 Combined operational leakage ≈ <b>' + fmtM(cancLoss + refundCost + soLoss) + '</b> — equal to <b>' + fx(100 * (cancLoss + refundCost + soLoss) / Math.max(1, k.rev), 1) + '%</b> of net revenue. Closing even half of this adds ~' + fx(0.5 * (cancLoss + refundCost + soLoss) / Math.max(1, served), 0) + ' ₹/order to contribution.</div>' +
      '</div></div>' +
      '<div class="grid">' +
      '<div class="panel"><h3>Daily net revenue vs variable ops cost</h3><div class="psub">rider payouts + packaging + refunds (₹K)</div><div class="chart-wrap" style="height:240px"><canvas id="fnTrend"></canvas></div></div>' +
      '<div class="panel"><h3>City P&L summary</h3><div class="psub">click a city to cross-filter the dashboard</div>' +
      '<div class="tscroll"><table class="tbl"><thead><tr><th>City</th><th class="num">Net revenue</th><th class="num">Ops cost</th><th class="num">Cost / order</th><th class="num">Contribution</th><th class="num">Margin</th></tr></thead><tbody>' +
      cityRows.sort((x, y) => y.a.rev - x.a.rev).map(r => '<tr class="clickable" data-city="' + DB.cities.indexOf(r.c) + '"><td><b style="color:var(--acc)">' + r.c.name + '</b></td>' +
        '<td class="num">' + fmtM(r.a.rev) + '</td><td class="num">' + fmtM(r.ocost) + '</td><td class="num">₹' + fx(r.cpo, 0) + '</td>' +
        '<td class="num" style="color:' + (r.contr >= 0 ? 'var(--green)' : 'var(--red)') + '">' + fmtM(r.contr) + '</td>' +
        '<td class="num">' + fx(r.m, 1) + '%</td></tr>').join('') +
      '</tbody></table></div></div></div>';

    el('page-finance').querySelectorAll('tr[data-city]').forEach(tr => tr.addEventListener('click', () => A.drillCity(+tr.dataset.city)));

    CH.mk('fnWf', {
      type: 'bar',
      data: { labels: wfLabels, datasets: [{ data: wfData, backgroundColor: wfColor, borderRadius: 5, maxBarThickness: 40 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c2) => steps[c2.dataIndex].lbl + ': ' + fmtM(Math.abs(steps[c2.dataIndex].v)) } }
        },
        scales: { x: { grid: { display: false }, ticks: { maxRotation: 28, font: { size: 9.5 } } }, y: { ticks: { callback: v => '₹' + v + 'L' }, grid: { color: CH.tokens().line } } }
      }
    });
    CH.line('fnTrend', lab2, [
      { label: 'Net revenue (₹K)', data: revT, fill: true, borderColor: '#ff4d9e' },
      { label: 'Variable ops cost (₹K)', data: costT, borderColor: '#fb923c' }
    ]);
    function leak(name, v, note) {
      const share = k.rev ? Math.min(100, 100 * v / k.rev) : 0;
      return '<div><div class="flex between small"><span><b>' + name + '</b> <span class="muted">· ' + note + '</span></span><span style="color:var(--red);font-weight:700">' + fmtM(v) + '</span></div>' +
        '<div class="meter" style="margin-top:4px"><i style="width:' + share + '%;background:var(--red)"></i></div></div>';
    }
  };

  /* ======================= 14. EXCEPTIONS CENTER ========================== */
  let sevFilter = 'all';
  PAGES.alerts = function (ctx) {
    const all = A.computeAlerts(ctx);
    const counts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    all.forEach(a => counts[a.sev]++);
    const list = sevFilter === 'all' ? all : all.filter(a => a.sev === sevFilter);

    el('page-alerts').innerHTML =
      '<div class="panel"><div class="flex between" style="flex-wrap:wrap;gap:10px"><div>' +
      '<h3>🚨 Operational Alerts &amp; Exceptions</h3><div class="psub">auto-generated rules: SLA &lt; 90% · delivery &gt; target · cancellation &gt; target · stock-out spikes · rider shortfall · picking anomalies · complaint surge · capacity &gt; 90%</div></div>' +
      '<div class="pill-select" id="alSev">' +
      ['all', 'Critical', 'High', 'Medium', 'Low'].map(s => '<button data-s="' + s + '" class="' + (sevFilter === s ? 'on' : '') + '">' + s + (s !== 'all' ? ' (' + counts[s] + ')' : ' (' + all.length + ')') + '</button>').join('') +
      '</div></div>' +
      '<div class="stat-strip" style="margin:12px 0">' +
      '<div class="stat-box bad"><div class="v">' + counts.Critical + '</div><div class="k">Critical</div></div>' +
      '<div class="stat-box warn"><div class="v">' + counts.High + '</div><div class="k">High</div></div>' +
      '<div class="stat-box"><div class="v" style="color:var(--amber)">' + counts.Medium + '</div><div class="k">Medium</div></div>' +
      '<div class="stat-box info"><div class="v">' + counts.Low + '</div><div class="k">Low</div></div>' +
      '</div></div>' +
      '<div class="grid" style="grid-template-columns:1fr;gap:11px">' +
      (list.length ? list.slice(0, 30).map(a => '<div data-sevrow="' + (a.loc.sid >= 0 ? a.loc.sid : -1) + '" data-city="' + a.loc.city + '" style="cursor:pointer">' + A.attentionCard(a) + '</div>').join('') : '<div class="panel"><div class="empty">✅ No exceptions at this severity in the selected scope.</div></div>') +
      '</div>';

    el('alSev').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { sevFilter = b.dataset.s; A.render(); }));
    el('page-alerts').querySelectorAll('[data-sevrow]').forEach(r => r.addEventListener('click', () => {
      const sid = +r.dataset.sevrow;
      if (sid >= 0) A.openStore(sid); else A.drillCity(+r.dataset.city);
    }));
  };

  /* ======================== 15. DIRECTOR INSIGHTS ========================= */
  PAGES.insights = function (ctx) {
    const insights = A.buildInsights(ctx);
    const icTone = {
      bad: ['rgba(255,93,115,.15)', '📉'],
      warn: ['rgba(255,176,32,.15)', '⚠️'],
      good: ['rgba(39,209,124,.15)', '📈']
    };
    const d = ctx.d, pd = ctx.pd, k = ctx.k, pk = ctx.pk;
    const cmpRow = (lbl, cur, prev, fmt, invert) => {
      const delta = prev != null && prev !== 0 ? 100 * (cur - prev) / Math.abs(prev) : null;
      const good = delta == null ? null : (invert ? delta < 0 : delta > 0);
      return '<tr><td>' + lbl + '</td><td class="num"><b>' + fmt(cur) + '</b></td><td class="num muted">' + (prev != null ? fmt(prev) : '—') + '</td>' +
        '<td class="num" style="color:' + (delta == null ? 'var(--muted)' : good ? 'var(--green)' : 'var(--red)') + ';font-weight:700">' + (delta == null ? '—' : (delta > 0 ? '▲ ' : '▼ ') + fx(Math.abs(delta), 1) + '%') + '</td></tr>';
    };

    el('page-insights').innerHTML =
      '<div class="panel"><h3>🧠 Executive Insights — auto-generated</h3><div class="psub">computed from the current filter scope: ' + A.rangeLabel(ctx.from, ctx.to) + (ctx.hasPrev ? ' · compared with ' + A.rangeLabel(ctx.prevFrom, ctx.prevTo) : '') + '</div>' +
      '<div class="tscroll sm" style="margin-bottom:14px"><table class="tbl"><thead><tr><th>Metric</th><th class="num">Current</th><th class="num">Previous</th><th class="num">Change</th></tr></thead><tbody>' +
      cmpRow('Orders', k.n, ctx.hasPrev ? pk.n : null, fmtN) +
      cmpRow('Net revenue', k.rev, ctx.hasPrev ? pk.rev : null, fmtM) +
      cmpRow('AOV', d.aov, ctx.hasPrev ? pd.aov : null, v => '₹' + fmtN(v)) +
      cmpRow('SLA compliance', d.slaPct, ctx.hasPrev ? pd.slaPct : null, pct1) +
      cmpRow('Avg delivery time', d.avgTotal, ctx.hasPrev ? pd.avgTotal : null, fmtMin, true) +
      cmpRow('Cancellation rate', d.cancelRate, ctx.hasPrev ? pd.cancelRate : null, pct1, true) +
      cmpRow('Complaint rate', d.compRate, ctx.hasPrev ? pd.compRate : null, pct1, true) +
      cmpRow('Refund rate', d.refundRate, ctx.hasPrev ? pd.refundRate : null, pct1, true) +
      '</tbody></table></div>' +
      '<div class="grid g2" style="margin-top:0">' +
      insights.map(i => '<div class="ins-card ' + i.tone + '"><div class="ins-ic" style="background:' + icTone[i.tone][0] + '">' + icTone[i.tone][1] + '</div><div><div class="ins-tag">' + i.tag + '</div><p>' + i.html + '</p></div></div>').join('') +
      '</div></div>';
  };

  /* ========================== 16. ACTION CENTER =========================== */
  const OWNERS = { sla: 'City Ops Manager', rassign: 'Fleet & Partner Lead', pick: 'Store Operations', rwait: 'Store Operations', cancel: 'Store Operations', stock: 'Catalog & Supply Chain', complaint: 'CX Quality Lead', capacity: 'Workforce Planning' };
  const PRIO = { Critical: ['P1', 'st-crit'], High: ['P2', 'st-high'], Medium: ['P3', 'st-medium'], Low: ['P4', 'st-low'] };
  const PROBLEM_TITLES = {
    sla: 'SLA compliance below threshold', rassign: 'Rider assignment too slow',
    pick: 'Picking time above network norm', rwait: 'Riders idle at store waiting for packing',
    cancel: 'Cancellation rate above target', stock: 'Stock-outs causing lost sales',
    complaint: 'Complaint rate elevated', capacity: 'Peak demand over store capacity'
  };
  PAGES.actions = function (ctx) {
    const alerts = A.computeAlerts(ctx).slice(0, 10);
    const k = ctx.k, d = ctx.d;
    // quantify headline numbers
    const revLeak = ctx.cur.reduce((a, o) => a + (o.status === 1 ? o.val : 0), 0) + k.refAmt + ctx.soLost;
    el('page-actions').innerHTML =
      '<div class="panel"><h3>✅ This period\'s command agenda</h3><div class="psub">prioritized management actions derived from the Exceptions Center · scope: ' + A.rangeLabel(ctx.from, ctx.to) + '</div>' +
      '<div class="stat-strip" style="margin:10px 0 4px">' +
      '<div class="stat-box bad"><div class="v">' + alerts.filter(a => a.sev === 'Critical').length + '</div><div class="k">P1 priorities</div></div>' +
      '<div class="stat-box warn"><div class="v">' + alerts.filter(a => a.sev === 'High').length + '</div><div class="k">P2 priorities</div></div>' +
      '<div class="stat-box"><div class="v" style="color:var(--red)">' + fmtM(revLeak) + '</div><div class="k">addressable revenue leak</div></div>' +
      '<div class="stat-box info"><div class="v">' + fmtN(alerts.reduce((a, x) => a + (x.ordersImp || 0), 0)) + '</div><div class="k">orders impacted</div></div>' +
      '</div></div>' +
      '<div class="grid g2" style="margin-top:0">' +
      (alerts.length ? alerts.map((a, i) => {
        const p = PRIO[a.sev];
        return '<div class="act-card"><div class="act-head"><div class="act-title">' + (i + 1) + '. ' + (PROBLEM_TITLES[a.rule] || a.metric) + ' — ' + a.loc.storeName + '</div><span class="act-prio status-pill ' + p[1] + '">' + p[0] + '</span></div>' +
          '<div class="act-row"><div class="k">Location</div><div class="v">' + a.loc.cityName + ' · ' + a.loc.storeName + (a.loc.code ? ' (' + a.loc.code + ')' : '') + '</div></div>' +
          '<div class="act-row"><div class="k">Problem</div><div class="v">' + a.metric + ': <b style="color:var(--red)">' + a.cur + '</b> vs target <b style="color:var(--green)">' + a.target + '</b></div></div>' +
          '<div class="act-row"><div class="k">Root cause</div><div class="v">' + a.cause + '</div></div>' +
          '<div class="act-row"><div class="k">Impact</div><div class="v">' + a.impact + '</div></div>' +
          '<div class="att-action">💡 <b>Action:</b> ' + a.action + '</div>' +
          '<div class="act-row"><div class="k">Owner</div><div class="v">' + (OWNERS[a.rule] || 'City Ops Manager') + ' · review in next ops stand-up</div></div>' +
          (a.loc.sid >= 0 ? '<button class="btn-reset" style="align-self:flex-start" data-sid="' + a.loc.sid + '">Open store drill-down →</button>' : '<button class="btn-reset" style="align-self:flex-start" data-city="' + a.loc.city + '">Filter to ' + a.loc.cityName + ' →</button>') +
          '</div>';
      }).join('') : '<div class="panel"><div class="empty">✅ No actions needed — network is running inside all guardrails.</div></div>') +
      '</div>';

    el('page-actions').querySelectorAll('[data-sid]').forEach(b => b.addEventListener('click', () => A.openStore(+b.dataset.sid)));
    el('page-actions').querySelectorAll('[data-city]').forEach(b => b.addEventListener('click', () => A.drillCity(+b.dataset.city)));
  };
})();
