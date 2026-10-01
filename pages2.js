/* ============================================================================
 * pages2.js — SLA & Delivery · Delay Root Causes · Rider Performance ·
 * Inventory & Stock-outs
 * ==========================================================================*/
(function () {
  'use strict';
  const A = window.APP, DB = A.DB;
  const { fmtM, fmtN, fmtMin, pct1, fx } = A;
  const el = (id) => document.getElementById(id);
  const pct = (arr, p) => {
    if (!arr.length) return 0;
    const s = arr.slice().sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor(p * s.length))];
  };

  /* ======================= 5. SLA & DELIVERY PERFORMANCE ================== */
  PAGES.sla = function (ctx) {
    const L = ctx.cur.filter(o => o.total >= 0);
    const tot = L.map(o => o.total);
    const stages = {};
    const defs = [
      ['Order → Acceptance', o => o.acc >= 0 ? o.acc - o.t : null],
      ['Accept → Picking start', o => (o.pkS >= 0 && o.acc >= 0) ? o.pkS - o.acc : null],
      ['Picking (shop floor)', o => o.pkE >= 0 ? o.pkE - o.pkS : null],
      ['Packing', o => o.pkF >= 0 ? o.pkF - o.pkE : null],
      ['Rider assign + arrive', o => (o.rAr >= 0 && o.acc >= 0) ? o.rAr - o.acc : null],
      ['Rider wait at store', o => (o.ds >= 0 && o.rAr >= 0) ? Math.max(0, o.ds - o.rAr) : null],
      ['Dispatch → Doorstep', o => (o.del >= 0 && o.ds >= 0) ? o.del - o.ds : null]
    ];
    defs.forEach(([name, fn]) => { stages[name] = L.map(fn).filter(v => v != null); });
    const buckets = [0, 0, 0, 0, 0];
    L.forEach(o => { const t = o.total; if (t <= 10) buckets[0]++; else if (t <= 15) buckets[1]++; else if (t <= 20) buckets[2]++; else if (t <= 30) buckets[3]++; else buckets[4]++; });
    const d = ctx.d;

    el('page-sla').innerHTML =
      A.kpiGrid([
        A.kpiHTML({ label: 'SLA Compliance', cur: d.slaPct, prev: ctx.hasPrev ? ctx.pd.slaPct : null, fmt: pct1, target: 90, ach: d.slaPct / 90 * 100, color: d.slaPct >= 90 ? 'var(--green)' : 'var(--red)' }),
        A.kpiHTML({ label: 'Avg Order→Delivery', cur: d.avgTotal, fmt: fmtMin, invert: true, target: 15, ach: 100 * 15 / Math.max(.01, d.avgTotal), color: 'var(--acc)' }),
        A.kpiHTML({ label: 'Median (P50)', cur: pct(tot, .5), fmt: fmtMin, color: 'var(--acc2)' }),
        A.kpiHTML({ label: 'P90 Delivery', cur: pct(tot, .9), fmt: fmtMin, color: 'var(--amber)' }),
        A.kpiHTML({ label: 'P95 Delivery', cur: pct(tot, .95), fmt: fmtMin, invert: true, color: 'var(--red)' }),
        A.kpiHTML({ label: 'Breached Orders', cur: ctx.k.slaB, invert: true, fmt: fmtN, color: 'var(--red)' }),
        A.kpiHTML({ label: '≤ 10 min', cur: d.le10p, fmt: pct1, color: 'var(--green)' }),
        A.kpiHTML({ label: '≤ 15 min', cur: d.le15p, fmt: pct1, color: 'var(--green)' })
      ]) +
      '<div class="grid g32">' +
      '<div class="panel"><h3>Delivery time distribution</h3><div class="psub">SLA window: ≤ ' + DB.slaMin + ' min</div><div class="chart-wrap" style="height:255px"><canvas id="slaBucket"></canvas></div></div>' +
      '<div class="panel"><h3>Stage-by-stage journey analytics</h3><div class="psub">where minutes are spent across the order lifecycle</div>' +
      '<div class="tscroll"><table class="tbl"><thead><tr><th>Stage</th><th class="num">Avg</th><th class="num">Median</th><th class="num">P90</th><th class="num">P95</th><th>Share of journey</th></tr></thead><tbody>' +
      defs.map(([name]) => {
        const arr = stages[name];
        const avg = arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length);
        const share = 100 * avg / d.avgStore || 0;
        return '<tr><td><b>' + name + '</b></td><td class="num">' + fx(avg, 1) + '</td><td class="num">' + fx(pct(arr, .5), 1) + '</td><td class="num"' + (pct(arr, .9) > avg * 2.2 ? ' style="color:var(--amber)"' : '') + '>' + fx(pct(arr, .9), 1) + '</td><td class="num">' + fx(pct(arr, .95), 1) + '</td>' +
          '<td><div class="meter" style="width:110px"><i style="width:' + Math.min(100, share) + '%;background:var(--acc)"></i></div></td></tr>';
      }).join('') + '</tbody></table></div></div>' +
      '<div class="chart-wrap" style="height:190px;margin-top:12px"><canvas id="slaStage"></canvas></div>' +
      '</div>' +
      '<div class="grid g2">' +
      '<div class="panel"><h3>SLA compliance trend</h3><div class="psub">daily · target 90%</div><div class="chart-wrap" style="height:235px"><canvas id="slaTrend"></canvas></div></div>' +
      '<div class="panel"><h3>Late deliveries trend</h3><div class="psub">orders breaching ' + DB.slaMin + '-min SLA per day</div><div class="chart-wrap" style="height:235px"><canvas id="slaLate"></canvas></div></div>' +
      '</div>' +
      '<div class="grid g2">' +
      '<div class="panel"><h3>City SLA comparison</h3><div class="psub">bars below 90% are red</div><div class="chart-wrap" style="height:260px"><canvas id="slaCity"></canvas></div></div>' +
      '<div class="panel"><h3>Store SLA comparison — bottom 12</h3><div class="psub">stores (min 20 orders) · click a row from Store Performance to drill in</div><div class="chart-wrap" style="height:260px"><canvas id="slaStore"></canvas></div></div>' +
      '</div>';

    CH.bar('slaBucket', ['0–10 min', '10–15 min', '15–20 min', '20–30 min', '30+ min'], [{
      label: 'Orders', data: buckets,
      backgroundColor: ['#2fd48a', '#ff4d9e', '#fbbf24', '#fb923c', '#ff5d7e']
    }], { legend: false });
    const stageAvgs = defs.map(([name]) => { const arr = stages[name]; return fx(arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length), 1); });
    CH.bar('slaStage', ['Accept', 'Pick queue', 'Picking', 'Packing', 'Assign+Arrive', 'Rider wait', 'Last mile'].slice(0, defs.length),
      [{ label: 'Avg minutes', data: stageAvgs, backgroundColor: ['#a94df5', '#e879f9', '#c084fc', '#a3e635', '#ff4d9e', '#fbbf24', '#fb923c'].slice(0, defs.length) }], { legend: false });

    const lab = [], slaT = [], lateT = [];
    for (let d2 = ctx.from; d2 <= ctx.to; d2++) {
      const a = ctx.byDay.get(d2); lab.push(DB.days[d2].label);
      slaT.push(a ? fx(A.der(a).slaPct, 1) : null);
      lateT.push(a ? a.slaB : 0);
    }
    CH.line('slaTrend', lab, [{ label: 'SLA %', data: slaT, fill: true, borderColor: '#ff4d9e' }, { label: 'Target 90%', data: lab.map(() => 90), borderColor: '#ff5d7e', borderDash: [6, 5], pointRadius: 0 }], { yFmt: v => v + '%' });
    CH.line('slaLate', lab, [{ label: 'Breached orders', data: lateT, fill: true, borderColor: '#ff5d7e' }]);

    const cityRows = DB.cities.map((c, ci) => ({ c, a: ctx.byCity.get(ci) })).filter(x => x.a && x.a.totN > 0);
    CH.bar('slaCity', cityRows.map(x => x.c.name), [{
      label: 'SLA %', data: cityRows.map(x => fx(A.der(x.a).slaPct, 1)),
      backgroundColor: cityRows.map(x => A.der(x.a).slaPct >= 90 ? '#2fd48a' : '#ff5d7e')
    }], { legend: false, yFmt: v => v + '%' });

    const storeRows = [];
    ctx.byStore.forEach((a, sid) => { if (a.totN >= 20) storeRows.push({ sid, d: A.der(a) }); });
    storeRows.sort((x, y) => x.d.slaPct - y.d.slaPct);
    const bottom = storeRows.slice(0, 12);
    CH.bar('slaStore', bottom.map(x => DB.stores[x.sid].code), [{
      label: 'SLA %', data: bottom.map(x => fx(x.d.slaPct, 1)),
      backgroundColor: bottom.map(x => x.d.slaPct >= 90 ? '#2fd48a' : x.d.slaPct >= 82 ? '#fbbf24' : '#ff5d7e')
    }], { legend: false, h: true, yFmt: v => v + '%' });
  };

  /* ======================= 6. DELAY ROOT CAUSE ANALYSIS =================== */
  PAGES.delays = function (ctx) {
    const L = ctx.cur.filter(o => o.sla);           // breached orders
    const revImp = L.reduce((a, o) => a + o.val, 0);
    const reasons = {};
    L.forEach(o => { const k = o.dR >= 0 ? o.dR : 11; reasons[k] = (reasons[k] || 0) + 1; });
    const rSorted = Object.keys(reasons).map(k => ({ k: +k, n: reasons[k] })).sort((a, b) => b.n - a.n);
    const cumArr = []; let csum = 0;
    rSorted.forEach(r => { csum += r.n; cumArr.push(fx(100 * csum / Math.max(1, L.length), 1)); });
    const cmpLate = L.filter(o => o.cmp >= 0).length;

    // impact cards for top 5 reasons
    const impact = rSorted.slice(0, 5).map(r => {
      const rows = L.filter(o => (o.dR >= 0 ? o.dR : 11) === r.k);
      const rv = rows.reduce((a, o) => a + o.val, 0);
      const avgLate = rows.reduce((a, o) => a + o.total, 0) / Math.max(1, rows.length);
      const cmp = rows.filter(o => o.cmp >= 0).length;
      return { name: DB.delayReasons[r.k], n: r.n, rv, avgLate, cmp };
    });

    // drill: breaches by city then store
    const byCity = A.groupAgg(L, o => o.city);
    const byStoreLate = A.groupAgg(L, o => o.store);

    el('page-delays').innerHTML =
      A.kpiGrid([
        A.kpiHTML({ label: 'Delayed Orders (SLA breach)', cur: L.length, fmt: fmtN, invert: true, color: 'var(--red)' }),
        A.kpiHTML({ label: 'Breach Rate', cur: ctx.d.slaPct ? 100 - ctx.d.slaPct : 0, fmt: pct1, invert: true, target: 10, ach: 100 * 10 / Math.max(.01, 100 - ctx.d.slaPct), color: 'var(--red)' }),
        A.kpiHTML({ label: 'Revenue at Risk', cur: revImp, fmt: fmtM, invert: true, color: 'var(--orange)' }),
        A.kpiHTML({ label: 'Complaints from delays', cur: cmpLate, fmt: fmtN, invert: true, color: 'var(--amber)' }),
        A.kpiHTML({ label: 'Avg delay (breached)', cur: L.length ? L.reduce((a, o) => a + o.total, 0) / L.length : 0, fmt: fmtMin, invert: true, color: 'var(--red)' }),
        A.kpiHTML({ label: 'P90 breach severity', cur: pct(L.map(o => o.total), .9), fmt: fmtMin, invert: true, color: 'var(--orange)' })
      ]) +
      '<div class="grid g32">' +
      '<div class="panel"><h3>Top reasons responsible for operational delays — Pareto</h3><div class="psub">bars: orders impacted · line: cumulative share</div><div class="chart-wrap" style="height:300px"><canvas id="dlPareto"></canvas></div></div>' +
      '<div class="panel"><h3>Delay impact — top drivers</h3><div class="psub">orders · revenue · customer impact per root cause</div>' +
      '<div class="tscroll" style="max-height:300px"><table class="tbl"><thead><tr><th>Root cause</th><th class="num">Orders</th><th class="num">Revenue</th><th class="num">Avg late</th><th class="num">Complaints</th></tr></thead><tbody>' +
      impact.map(i => '<tr><td><b>' + i.name + '</b></td><td class="num">' + fmtN(i.n) + '</td><td class="num">' + fmtM(i.rv) + '</td><td class="num">' + fx(i.avgLate, 0) + 'm</td><td class="num">' + fmtN(i.cmp) + '</td></tr>').join('') +
      '</tbody></table></div>' +
      '<div class="sec-title">Breach heat: hour of day</div><div class="chart-wrap" style="height:120px"><canvas id="dlHour"></canvas></div></div>' +
      '</div>' +
      '<div class="grid">' +
      '<div class="panel"><h3>Drill-down: Company → City → Zone → Store → Order</h3><div class="psub">click a city to expand its worst stores · click a store for its drawer · click an order for its timeline</div>' +
      '<div id="dlDrill">' + delayDrill(ctx, byCity, byStoreLate, L, -1) + '</div>' +
      '</div>' +
      '<div class="panel"><h3>Latest breached orders</h3><div class="psub">click any row for the full journey timeline</div>' +
      A.ordersTable(L.slice().sort((a, b) => b.t - a.t).slice(0, 40), ctx, true) + '</div>' +
      '</div>';

    CH.mk('dlPareto', {
      data: {
        labels: rSorted.map(r => DB.delayReasons[r.k]),
        datasets: [
          { type: 'bar', label: 'Orders impacted', data: rSorted.map(r => r.n), backgroundColor: '#a94df5', borderRadius: 6, yAxisID: 'y' },
          { type: 'line', label: 'Cumulative %', data: cumArr, borderColor: '#fbbf24', yAxisID: 'y2', tension: .3, pointRadius: 3 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: true } },
        scales: { x: { ticks: { maxRotation: 32, autoSkip: false, font: { size: 9.5 } } }, y: { beginAtZero: true, grid: { color: CH.tokens().line } }, y2: { position: 'right', min: 0, max: 100, grid: { display: false }, ticks: { callback: v => v + '%' } } }
      }
    });
    const hb = new Array(24).fill(0);
    L.forEach(o => hb[o.h]++);
    CH.bar('dlHour', Array.from({ length: 24 }, (_, h) => h + ':00'), [{ label: 'Breaches', data: hb, backgroundColor: hb.map((v, h) => h >= 18 && h <= 22 ? '#ff5d7e' : '#a94df5') }], { legend: false });

    el('dlDrill').addEventListener('click', (e) => {
      const c = e.target.closest('[data-dcity]');
      if (c) {
        const open = c.dataset.open === '1';
        document.querySelectorAll('[data-dcity]').forEach(n => n.dataset.open = '0');
        c.dataset.open = open ? '0' : '1';
        el('dlDrill').innerHTML = delayDrill(ctx, byCity, byStoreLate, L, open ? -1 : +c.dataset.dcity);
        el('dlDrill').querySelectorAll('tr[data-sid]').forEach(tr => tr.addEventListener('click', (ev) => { ev.stopPropagation(); A.openStore(+tr.dataset.sid); }));
        A.bindOrderRows(el('dlDrill'));
      }
    });
    el('page-delays').querySelectorAll('tr[data-oid]').forEach(() => { }); // delegation handles modals
    A.bindOrderRows(el('page-delays'));
  };
  function delayDrill(ctx, byCity, byStoreLate, L, openCity) {
    const rows = [];
    byCity.forEach((a, ci) => rows.push({ ci, a }));
    rows.sort((x, y) => y.a.n - x.a.n);
    let h = '<div class="tscroll"><table class="tbl"><thead><tr><th></th><th>Level</th><th class="num">Delayed</th><th class="num">Share</th><th class="num">Revenue at risk</th><th class="num">Top root cause</th><th class="num">Avg late</th></tr></thead><tbody>';
    const tot = L.length || 1;
    rows.forEach(r => {
      const d = A.der(r.a);
      // top reason in city
      const rr = {};
      L.forEach(o => { if (o.city === r.ci) { const k = o.dR >= 0 ? o.dR : 11; rr[k] = (rr[k] || 0) + 1; } });
      const topR = Object.keys(rr).sort((a, b) => rr[b] - rr[a])[0];
      h += '<tr class="clickable" data-dcity="' + r.ci + '" data-open="' + (openCity === r.ci ? 1 : 0) + '">' +
        '<td>' + (openCity === r.ci ? '▾' : '▸') + '</td>' +
        '<td><b style="color:var(--acc)">' + DB.cities[r.ci].name + '</b></td>' +
        '<td class="num">' + fmtN(r.a.n) + '</td><td class="num">' + pct1(100 * r.a.n / tot) + '</td>' +
        '<td class="num">' + fmtM(r.a.gmv) + '</td><td class="num">' + DB.delayReasons[topR] + '</td>' +
        '<td class="num">' + fmtMin(d.avgTotal) + '</td></tr>';
      if (openCity === r.ci) {
        const srows = [];
        byStoreLate.forEach((a2, sid) => { if (DB.stores[sid].city === r.ci) srows.push({ sid, a: a2 }); });
        srows.sort((x, y) => y.a.n - x.a.n);
        srows.slice(0, 8).forEach(sr => {
          const st = DB.stores[sr.sid], sd = A.der(sr.a);
          h += '<tr class="clickable" data-sid="' + sr.sid + '" style="background:var(--panel3)">' +
            '<td></td><td style="padding-left:26px">' + st.code + ' · ' + st.label + ' <span class="tag">' + DB.cities[r.ci].zones[st.zone] + '</span></td>' +
            '<td class="num">' + fmtN(sr.a.n) + '</td><td class="num">' + pct1(100 * sr.a.n / r.a.n) + '</td>' +
            '<td class="num">' + fmtM(sr.a.gmv) + '</td><td class="num">—</td><td class="num">' + fmtMin(sd.avgTotal) + '</td></tr>';
        });
      }
    });
    h += '</tbody></table></div>';
    return h;
  }

  /* ========================= 7. RIDER PERFORMANCE ========================= */
  PAGES.riders = function (ctx) {
    const k = ctx.k, d = ctx.d;
    const delN = k.del + k.ref;
    const activeRiders = k.riders.size;
    // on-shift rider-days in scope
    const storeSet = ctx.f.store !== 'all' ? [+ctx.f.store] : DB.stores.filter(s =>
      (ctx.f.city === 'all' || s.city === +ctx.f.city) &&
      (ctx.f.zone === 'all' || (s.city === +ctx.f.city && s.zone === +ctx.f.zone))).map(s => s.id);
    let riderDays = 0;
    storeSet.forEach(sid => {
      DB.storeRiders[sid].forEach(ri => {
        for (let day = ctx.from; day <= ctx.to; day++) if (DB.riderOnShift(ri, day)) riderDays++;
      });
    });
    const rPerDay = riderDays / Math.max(1, ctx.len);
    const delPerRiderDay = delN / Math.max(1, riderDays);
    const util = delPerRiderDay / 6;             // benchmark: 6 deliveries / shift-day
    const idleMin = k.waitS;
    const distK = k.distS;

    // demand vs supply by hour
    const dem = new Array(24).fill(0);
    ctx.cur.forEach(o => { if (o.status !== 1) dem[o.h]++; });
    const sup = new Array(24).fill(0);
    storeSet.forEach(sid => DB.storeRiders[sid].forEach(ri => {
      const r = DB.riders[ri];
      for (let h = r.shiftStart; h < r.shiftStart + 9 && h < 24; h++) sup[h]++;
    }));
    const supAdj = sup.map(v => fx(v * 0.62 * 0.88, 0));   // roster × duty factors
    const needed = dem.map(v => fx(v / Math.max(1, ctx.len) * 0.55, 0)); // riders needed per hour (33-min cycle)

    // rider ranking
    const rAgg = A.groupAgg(ctx.cur.filter(o => o.status !== 1), o => o.rider);
    const rRows = [];
    rAgg.forEach((a, rid) => { if (DB.riders[rid]) rRows.push({ rid, a, d: A.der(a) }); });
    rRows.sort((x, y) => y.a.n - x.a.n);
    const waitIdle = fx(idleMin / Math.max(1, riderDays), 1);

    // distribution of O2D
    const hist = new Array(8).fill(0);
    ctx.cur.forEach(o => { if (o.total >= 0) { const b = Math.min(7, Math.floor(o.total / 5)); hist[b]++; } });

    el('page-riders').innerHTML =
      A.kpiGrid([
        A.kpiHTML({ label: 'Active Riders (had orders)', cur: activeRiders, fmt: fmtN, color: 'var(--acc)' }),
        A.kpiHTML({ label: 'On-shift riders / day', cur: rPerDay, fmt: v => fx(v, 0), color: 'var(--acc2)' }),
        A.kpiHTML({ label: 'Total Deliveries', cur: delN, fmt: fmtN, color: 'var(--green)' }),
        A.kpiHTML({ label: 'Deliveries / Rider / Day', cur: delPerRiderDay, fmt: v => fx(v, 1), target: 6, ach: util * 100, color: 'var(--vio)' }),
        A.kpiHTML({ label: 'Rider Utilization', cur: util * 100, fmt: pct1, target: 75, ach: util * 100 / 75 * 100, color: util * 100 >= 70 ? 'var(--green)' : 'var(--amber)' }),
        A.kpiHTML({ label: 'Avg Assignment Time', cur: d.avgAsg, fmt: fmtMin, invert: true, target: 2.5, ach: 100 * 2.5 / Math.max(.01, d.avgAsg), color: 'var(--acc)' }),
        A.kpiHTML({ label: 'Avg Wait at Store', cur: d.avgWait, fmt: fmtMin, invert: true, color: 'var(--amber)' }),
        A.kpiHTML({ label: 'Avg Last-Mile Ride', cur: d.avgRide, fmt: fmtMin, invert: true, color: 'var(--acc2)' }),
        A.kpiHTML({ label: 'Idle (store wait) per rider-day', cur: +waitIdle, fmt: v => fx(v, 1) + ' min', invert: true, color: 'var(--orange)' }),
        A.kpiHTML({ label: 'Distance Travelled', cur: distK, fmt: v => fmtN(v) + ' km', color: 'var(--green)' })
      ]) +
      '<div class="grid g32">' +
      '<div class="panel"><h3>Order demand vs available riders — by hour</h3><div class="psub">red markers: demand &gt; rider capacity (shortfall windows)</div><div class="chart-wrap" style="height:280px"><canvas id="rdSupply"></canvas></div>' +
      '<div class="legend"><span><i style="background:#a94df5"></i>Riders needed (demand)</span><span><i style="background:#ff4d9e"></i>Riders on duty (supply)</span><span><i style="background:#ff5d7e"></i>Shortfall hour</span></div></div>' +
      '<div class="panel"><h3>Rider utilization by hour</h3><div class="psub">demand ÷ supply · &gt;90% means shortfall risk</div><div class="chart-wrap" style="height:240px"><canvas id="rdUtil"></canvas></div>' +
      '<div class="sec-title">Order-to-delivery distribution</div><div class="chart-wrap" style="height:170px"><canvas id="rdHist"></canvas></div></div>' +
      '</div>' +
      '<div class="panel"><h3>Rider performance ranking — top 25 by deliveries</h3><div class="psub">period: ' + A.rangeLabel(ctx.from, ctx.to) + ' · a healthy rider keeps assignment &lt; 3 min and wait &lt; 3 min</div>' +
      '<div class="tscroll sm"><table class="tbl"><thead><tr><th>#</th><th>Rider</th><th>Store</th><th>City</th><th class="num">Deliveries</th><th class="num">Avg ride</th><th class="num">Avg assign</th><th class="num">Avg wait</th><th class="num">Distance</th><th class="num">SLA %</th></tr></thead><tbody>' +
      rRows.slice(0, 25).map((r, i) => {
        const rider = DB.riders[r.rid], st = DB.stores[rider.store];
        return '<tr><td><span class="rank' + (i < 3 ? ' top' : '') + '">' + (i + 1) + '</span></td><td><b>' + rider.id + '</b></td>' +
          '<td class="muted">' + st.code + '</td><td class="muted">' + DB.cities[rider.city].name + '</td>' +
          '<td class="num">' + fmtN(r.a.n) + '</td><td class="num">' + fx(r.d.avgRide, 1) + '</td>' +
          '<td class="num"' + (r.d.avgAsg > 3.5 ? ' style="color:var(--amber)"' : '') + '>' + fx(r.d.avgAsg, 1) + '</td>' +
          '<td class="num"' + (r.d.avgWait > 3.5 ? ' style="color:var(--amber)"' : '') + '>' + fx(r.d.avgWait, 1) + '</td>' +
          '<td class="num">' + fx(r.a.distS, 0) + ' km</td><td class="num">' + pct1(r.d.slaPct) + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';

    const hours = Array.from({ length: 24 }, (_, h) => h + ':00');
    CH.mk('rdSupply', {
      data: {
        labels: hours,
        datasets: [
          { type: 'bar', label: 'Riders needed', data: needed, backgroundColor: needed.map((v, i) => +v > +supAdj[i] ? '#ff5d7e' : '#a94df5'), borderRadius: 5 },
          { type: 'line', label: 'Riders on duty', data: supAdj, borderColor: '#ff4d9e', tension: .3, pointRadius: 3 }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: CH.tokens().line } } } }
    });
    CH.line('rdUtil', hours, [{
      label: 'Utilization %', data: needed.map((v, i) => supAdj[i] > 0 ? fx(100 * v / supAdj[i], 0) : null),
      borderColor: '#fbbf24', fill: true, segment: { borderColor: c => (c.p1.parsed.y > 90 ? '#ff5d7e' : '#fbbf24') }
    }], { yFmt: v => v + '%', legend: false });
    CH.bar('rdHist', ['0–5', '5–10', '10–15', '15–20', '20–25', '25–30', '30–35', '35+ min'], [{
      label: 'Orders', data: hist,
      backgroundColor: hist.map((v, i) => i >= 4 ? '#ff5d7e' : i >= 3 ? '#fbbf24' : '#2fd48a')
    }], { legend: false });
  };

  /* ===================== 8. INVENTORY & STOCK-OUTS ======================== */
  PAGES.inventory = function (ctx) {
    const soL = ctx.soL;
    const storesN = ctx.k.stores.size || 1;
    const soHours = soL.reduce((a, s) => a + s.hours, 0);
    const avail = 100 * (1 - soHours / (storesN * ctx.len * 24 * 10));
    const oosCancel = ctx.cur.filter(o => o.cr === 1).length;
    const skuAgg = new Map(), catHours = new Array(10).fill(0), catEv = new Array(10).fill(0);
    soL.forEach(s => {
      const key = s.sku + '|' + s.skuName;
      skuAgg.set(key, (skuAgg.get(key) || 0) + 1);
      catHours[s.cat] += s.hours; catEv[s.cat]++;
    });
    const topSkus = [...skuAgg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    const catAvail = catHours.map(h => 100 * (1 - h / (storesN * ctx.len * 24)));
    // store × category heat (top 15 stores by events)
    const stEv = [...ctx.soByStore.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
    const lostByCat = new Array(10).fill(0);
    soL.forEach(s => lostByCat[s.cat] += s.lostRev);

    el('page-inventory').innerHTML =
      A.kpiGrid([
        A.kpiHTML({ label: 'Inventory Availability', cur: avail, fmt: v => fx(v, 1) + '%', target: 98.5, ach: avail / 98.5 * 100, color: avail >= 98.5 ? 'var(--green)' : 'var(--amber)' }),
        A.kpiHTML({ label: 'Stock-out Events', cur: soL.length, fmt: fmtN, invert: true, color: 'var(--red)' }),
        A.kpiHTML({ label: 'Stores Affected', cur: ctx.soByStore.size, fmt: fmtN, color: 'var(--amber)' }),
        A.kpiHTML({ label: 'Out-of-stock Item Instances', cur: soL.reduce((a, s) => a + s.skus, 0), fmt: fmtN, invert: true, color: 'var(--orange)' }),
        A.kpiHTML({ label: 'Inventory-related Cancellations', cur: oosCancel, fmt: fmtN, invert: true, color: 'var(--red)' }),
        A.kpiHTML({ label: 'Est. Lost Revenue (stock-outs)', cur: ctx.soLost, fmt: fmtM, invert: true, color: 'var(--red)' }),
        A.kpiHTML({ label: 'Est. Lost Orders', cur: ctx.soOrders, fmt: fmtN, invert: true, color: 'var(--orange)' }),
        A.kpiHTML({ label: 'Avg Hours Out / Event', cur: soL.length ? soHours / soL.length : 0, fmt: v => fx(v, 1) + ' h', invert: true, color: 'var(--amber)' })
      ]) +
      '<div class="grid g2">' +
      '<div class="panel"><h3>Stock-out trend</h3><div class="psub">events per day in period</div><div class="chart-wrap" style="height:250px"><canvas id="ivTrend"></canvas></div></div>' +
      '<div class="panel"><h3>Lost sales due to stock-outs — by category</h3><div class="psub">estimated from demand lost × category basket value</div><div class="chart-wrap" style="height:250px"><canvas id="ivLost"></canvas></div></div>' +
      '</div>' +
      '<div class="grid g2">' +
      '<div class="panel"><h3>Category-wise availability</h3><div class="psub">share of open-hours the category was fully stocked</div><div class="chart-wrap" style="height:270px"><canvas id="ivCat"></canvas></div></div>' +
      '<div class="panel"><h3>Top stock-out SKUs</h3><div class="psub">synthetic SKUs · event frequency in period</div>' +
      '<div class="tscroll sm"><table class="tbl"><thead><tr><th>#</th><th>SKU</th><th class="num">Events</th></tr></thead><tbody>' +
      topSkus.map((sk, i) => '<tr><td><span class="rank' + (i < 3 ? ' top' : '') + '">' + (i + 1) + '</span></td><td><b>' + sk[0].split('|')[1] + '</b> <span class="tag">' + sk[0].split('|')[0] + '</span></td><td class="num">' + sk[1] + '</td></tr>').join('') +
      '</tbody></table></div></div>' +
      '</div>' +
      '<div class="panel"><h3>Store-wise stock-out heatmap — top 15 affected stores × category</h3><div class="psub">cell = stock-out events in period · click cells to open the store drawer</div>' +
      '<div id="ivHeat"></div></div>';

    const lab = [], ev = [];
    for (let day = ctx.from; day <= ctx.to; day++) { lab.push(DB.days[day].label); ev.push(ctx.soByDay.get(day) || 0); }
    CH.line('ivTrend', lab, [{ label: 'Stock-out events', data: ev, fill: true, borderColor: '#fb923c' }], { legend: false });
    CH.bar('ivLost', DB.cats.map((c, i) => c.name.split(' ')[0]), [{ label: 'Lost revenue (₹K)', data: lostByCat.map(v => fx(v / 1000, 1)), backgroundColor: '#ff5d7e' }], { legend: false, yFmt: v => '₹' + v + 'K', xRot: 25 });
    CH.bar('ivCat', DB.cats.map(c => c.name.length > 16 ? c.name.slice(0, 15) + '…' : c.name), [{ label: 'Availability %', data: catAvail.map(v => fx(v, 1)), backgroundColor: catAvail.map(v => v >= 99 ? '#2fd48a' : v >= 98 ? '#fbbf24' : '#ff5d7e') }], { legend: false, h: true, yFmt: v => v + '%' });

    const heatEl = el('ivHeat');
    const cats = DB.cats.map(c => c.name.split(' ')[0]);
    const cells = stEv.map(([sid]) => cats.map((cn, ci) => {
      const v = soL.filter(s => s.store === sid && s.cat === ci).length;
      return { v, tip: DB.stores[sid].code + ' · ' + DB.cats[ci].name + ': ' + v + ' events' };
    }));
    heatEl.innerHTML = CH.heatmap({
      rows: stEv.map(([sid]) => DB.stores[sid].code), cols: cats, cells,
      stops: CH.HEAT_RED, fmt: v => v
    }) + '<div class="small muted" style="margin-top:8px">' + stEv.map(([sid]) => '<span class="tag clickable" data-sid="' + sid + '" style="cursor:pointer">' + DB.stores[sid].code + ' · ' + DB.stores[sid].label + '</span>').join('') + '</div>';
    heatEl.querySelectorAll('[data-sid]').forEach(t => t.addEventListener('click', () => A.openStore(+t.dataset.sid)));
  };
})();
