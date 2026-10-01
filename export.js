/* ============================================================================
 * export.js — data export engine.
 *  - CSV export for any dataset / any rendered table
 *  - Full multi-worksheet .xlsx workbook generated client-side with a fast,
 *    streaming ZIP(STORE) + spreadsheet-XML writer (no library, handles the
 *    full ~118k order dataset in ~1 second).
 * ==========================================================================*/
window.EXPORTS = (function () {
  'use strict';
  const DB = window.DB;

  /* ------------------------------ CSV export ----------------------------- */
  function csvEsc(v) {
    if (v == null) return '';
    v = String(v);
    return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }
  function exportCSV(filename, headers, rows) {
    const lines = [headers.map(csvEsc).join(',')];
    for (let i = 0; i < rows.length; i++) lines.push(rows[i].map(csvEsc).join(','));
    saveBlob(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }), filename + '.csv');
  }
  function saveBlob(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }

  /* -------------------- XLSX writer (STORE zip, no lib) ------------------ */
  const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(u8) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < u8.length; i++) c = crcTable[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  const enc = new TextEncoder();
  async function deflateRaw(u8) {        // native browser/Node stream compression
    if (typeof CompressionStream === 'undefined') return null;
    const stream = new Blob([u8]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  async function zipStore(entries) {          // entries: [{name, data:Uint8Array}] — deflate when available
    const parts = [];
    for (const e of entries) {
      const comp = (e.data.length > 512) ? await deflateRaw(e.data) : null;
      parts.push({
        name: enc.encode(e.name), method: comp ? 8 : 0,
        data: comp || e.data, usize: e.data.length,
        crc: crc32(e.data)                       // CRC is always over UNCOMPRESSED data
      });
    }
    const chunks = [], central = [];
    let offset = 0;
    const push = (u8) => { chunks.push(u8); offset += u8.length; };
    for (const p of parts) {
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0, true);
      lh.setUint16(8, p.method, true); lh.setUint16(10, 0x7821, true); lh.setUint16(12, 0x0980, true);
      lh.setUint32(14, p.crc, true); lh.setUint32(18, p.data.length, true); lh.setUint32(22, p.usize, true);
      lh.setUint16(26, p.name.length, true); lh.setUint16(28, 0, true);
      push(new Uint8Array(lh.buffer)); push(p.name); push(p.data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true);
      ch.setUint16(10, p.method, true); ch.setUint16(12, 0x7821, true); ch.setUint16(14, 0x0980, true);
      ch.setUint32(16, p.crc, true); ch.setUint32(20, p.data.length, true); ch.setUint32(24, p.usize, true);
      ch.setUint16(28, p.name.length, true); ch.setUint32(42, offset - p.data.length - 30 - p.name.length, true);
      central.push(new Uint8Array(ch.buffer), p.name);
    }
    let cdSize = 0; central.forEach(u => cdSize += u.length);
    const eo = new DataView(new ArrayBuffer(22));
    eo.setUint32(0, 0x06054b50, true);
    eo.setUint16(8, parts.length, true); eo.setUint16(10, parts.length, true);
    eo.setUint32(12, cdSize, true); eo.setUint32(16, offset, true);
    return new Blob([...chunks, ...central, new Uint8Array(eo.buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  /* ------------------------- spreadsheet XML ------------------------------ */
  const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  function sheetXML(sheet, sst) {
    const rows = sheet.rows, nCols = sheet.headers.length;
    const parts = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
      '<sheetFormatPr defaultRowHeight="14.5"/><cols>'];
    for (let c = 0; c < nCols; c++) parts.push('<col min="' + (c + 1) + '" max="' + (c + 1) + '" width="16" customWidth="1"/>');
    parts.push('</cols><sheetData>');
    // register one shared empty string — MUST be emitted for blank cells,
    // because cells without refs take sequential positions in Excel
    const emptyIdx = (() => { sst.list.push(''); sst.map.set('', 0); return 0; })();
    const emitRow = (arr, ri, bold) => {
      parts.push('<row r="' + ri + '">');
      for (let c = 0; c < arr.length; c++) {
        const v = arr[c];
        if (v == null || v === '') { parts.push('<c t="s"><v>' + emptyIdx + '</v></c>'); continue; }
        if (typeof v === 'number' && isFinite(v)) { parts.push('<c' + (bold ? ' s="1"' : '') + '><v>' + v + '</v></c>'); continue; }
        let idx = sst.map.get(v);
        if (idx === undefined) { idx = sst.list.length; sst.list.push(v); sst.map.set(v, idx); }
        parts.push('<c t="s"' + (bold ? ' s="1"' : '') + '><v>' + idx + '</v></c>');
      }
      parts.push('</row>');
    };
    emitRow(sheet.headers, 1, true);
    for (let r = 0; r < rows.length; r++) emitRow(rows[r], r + 2, false);
    parts.push('</sheetData></worksheet>');
    return parts.join('');
  }
  function sstXML(sst) {
    const parts = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="' + sst.list.length + '" uniqueCount="' + sst.list.length + '">'];
    for (let i = 0; i < sst.list.length; i++) parts.push('<si><t xml:space="preserve">' + xmlEsc(sst.list[i]) + '</t></si>');
    parts.push('</sst>');
    return parts.join('');
  }
  const WORKBOOK_XML = (names) =>
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
    names.map((n, i) => '<sheet name="' + xmlEsc(n) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') + '</sheets></workbook>';
  const WB_RELS_XML = (n) =>
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    n.map((_, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') +
    '<Relationship Id="rId' + (n + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '<Relationship Id="rId' + (n + 2) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>' +
    '</Relationships>';
  const ROOT_RELS_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
  const CONTENT_TYPES_XML = (n) =>
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>' +
    n.map((_, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') +
    '</Types>';
  const STYLES_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF950EDB"/><name val="Calibri"/></font></fonts>' +
    '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="1"><border/></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
    '</styleSheet>';

  function sheetNameSafe(n) { return n.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31) || 'Sheet'; }

  async function exportWorkbook(filename, sheets) {
    const sst = { list: [], map: new Map() };
    const entries = [];
    const names = sheets.map(s => sheetNameSafe(s.name));
    sheets.forEach((s, i) => {
      entries.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: enc.encode(sheetXML(s, sst)) });
    });
    entries.push({ name: 'xl/sharedStrings.xml', data: enc.encode(sstXML(sst)) });
    entries.push({ name: 'xl/workbook.xml', data: enc.encode(WORKBOOK_XML(names)) });
    entries.push({ name: 'xl/_rels/workbook.xml.rels', data: enc.encode(WB_RELS_XML(sheets)) });
    entries.push({ name: 'xl/styles.xml', data: enc.encode(STYLES_XML) });
    entries.push({ name: '_rels/.rels', data: enc.encode(ROOT_RELS_XML) });
    entries.push({ name: '[Content_Types].xml', data: enc.encode(CONTENT_TYPES_XML(sheets)) });
    const blob = await zipStore(entries);
    saveBlob(blob, filename + '.xlsx');
    return blob.size;
  }

  /* ----------------------------- dataset rows ----------------------------- */
  const tstr = (t) => t != null && t >= 0 ? window.APP.dayLabelShort(Math.floor(t / 1440)) + ' ' + window.APP.minOfDay(t) : '';
  const mins = (a, b) => (a >= 0 && b >= 0) ? Math.round((a - b) * 100) / 100 : '';
  function orderRow(o) {
    const st = DB.stores[o.store];
    return [
      o.id, DB.days[o.day].date, (o.h < 10 ? '0' + o.h : o.h) + ':' + (o.m < 10 ? '0' + o.m : o.m),
      'C' + (100001 + o.cus), DB.cities[o.city].name, DB.cities[o.city].zones[o.zone] || DB.cities[st.city].zones[st.zone], st.code, st.label,
      DB.cats[o.cat].name, o.items, o.val, o.disc, o.fee, o.rev,
      DB.payMethods[o.pay], ['Paid', 'Refunded', 'Failed'][o.paySt], DB.statuses[o.status], DB.sources[o.src],
      o.n ? 'New' : 'Repeat',
      mins(o.acc, o.t), mins(o.pkE, o.pkS), mins(o.pkF, o.pkE), mins(o.rAs, o.acc),
      o.ds >= 0 && o.rAr >= 0 ? Math.round(Math.max(0, o.ds - o.rAr) * 100) / 100 : '',
      mins(o.del, o.ds), o.total >= 0 ? Math.round(o.total * 100) / 100 : '',
      o.sla ? 'Yes' : (o.total >= 0 ? 'No' : ''),
      o.dR >= 0 ? DB.delayReasons[o.dR] : '', o.cr >= 0 ? DB.cancelReasons[o.cr] : '',
      DB.riders[o.rider] ? DB.riders[o.rider].id : '', o.ref || 0,
      o.cmp >= 0 ? DB.complaintCats[o.cmp] : '', o.dist
    ];
  }
  const ORDER_HEADERS = ['Order ID', 'Date', 'Time', 'Customer ID', 'City', 'Zone', 'Store Code', 'Store Name',
    'Category', 'Items', 'Order Value (Rs)', 'Discount (Rs)', 'Delivery Fee (Rs)', 'Net Revenue (Rs)',
    'Payment Method', 'Payment Status', 'Order Status', 'Source', 'Customer Type',
    'Accept (min)', 'Picking (min)', 'Packing (min)', 'Rider Assign (min)', 'Rider Wait (min)', 'Last Mile (min)',
    'Total O2D (min)', 'SLA Breach', 'Delay Reason', 'Cancel Reason', 'Rider ID', 'Refund (Rs)', 'Complaint', 'Distance (km)'];

  const A = () => window.APP;
  const DATASETS = {
    orders_scope: {
      title: 'Orders — current filter scope', icon: '📦',
      desc: 'Order-level records matching the active global filters.',
      getRows: (ctx) => ctx.cur.map(orderRow), headers: ORDER_HEADERS
    },
    orders_full: {
      title: 'Orders — full 12 months', icon: '🗄️',
      desc: 'Complete synthetic order dataset (every order, all filters ignored).',
      getRows: () => DB.orders.map(orderRow), headers: ORDER_HEADERS
    },
    sla_breaches: {
      title: 'SLA breaches (delayed orders)', icon: '⏱️',
      desc: 'Orders that exceeded the 20-minute promise, with auto-assigned root cause.',
      getRows: (ctx) => ctx.cur.filter(o => o.sla).map(orderRow), headers: ORDER_HEADERS
    },
    cancellations: {
      title: 'Cancellations & refunds', icon: '✕',
      desc: 'Cancelled / refunded orders with reason codes (current scope).',
      getRows: (ctx) => ctx.cur.filter(o => o.status === 1 || o.ref > 0).map(orderRow), headers: ORDER_HEADERS
    },
    customers: {
      title: 'Customers', icon: '👥',
      desc: 'Synthetic customer base: sign-up day, segment, orders, spend.',
      headers: ['Customer ID', 'First Order Date', 'City', 'Orders', 'Total Spend (Rs)', 'Segment'],
      getRows: () => {
        const cityOf = new Map();
        DB.orders.forEach(o => { if (!cityOf.has(o.cus)) cityOf.set(o.cus, o.city); });
        return DB.customers.map(c => [c.id, DB.days[c.firstDay].date, DB.cities[cityOf.get(+c.id.slice(1) - 100001) ?? c.city]?.name || '', c.orders, Math.round(c.spend), c.seg]);
      }
    },
    riders: {
      title: 'Riders / delivery partners', icon: '🛵',
      desc: 'Rider roster with home store, shift start and reliability factor.',
      headers: ['Rider ID', 'Store Code', 'Store Name', 'City', 'Shift Start (hr)', 'Reliability Factor', 'Roster Probability'],
      getRows: () => DB.riders.map(r => [r.id, DB.stores[r.store].code, DB.stores[r.store].label, DB.cities[r.city].name, r.shiftStart, Math.round(r.perf * 100) / 100, Math.round(r.roster * 100) / 100])
    },
    stores: {
      title: 'Dark stores', icon: '🏪',
      desc: 'Network store master: staffing, capacity and performance tiers.',
      headers: ['Store Code', 'Store Name', 'City', 'Zone', 'Pickers', 'Packers', 'Other Staff', 'Riders', 'Rent (Rs lakh/mo)', 'Volume Share in City', 'Speed Multiplier', 'Chronic Rider Short', 'Stock-out Propensity'],
      getRows: () => DB.stores.map(s => [s.code, s.label, DB.cities[s.city].name, DB.cities[s.city].zones[s.zone], s.pickers, s.packers, s.staff, DB.storeRiders[s.id].length, s.rentL, Math.round(s.share * 1000) / 1000, Math.round(s.perf * 100) / 100, s.riderShort ? 'Yes' : 'No', Math.round(s.stockProp * 100) / 100])
    },
    cities: {
      title: 'Cities', icon: '🏙️',
      desc: 'City master with zones.',
      headers: ['City', 'Zones', 'Demand Share', 'Stores'],
      getRows: () => DB.cities.map((c, i) => [c.name, c.zones.join(' | '), c.share, DB.stores.filter(s => s.city === i).length])
    },
    categories: {
      title: 'Categories', icon: '🧺',
      desc: 'Product categories with demand share and SKU counts.',
      headers: ['Category', 'Demand Share', 'Avg Item Price (Rs)', 'SKU Count'],
      getRows: () => DB.cats.map(c => [c.name, c.share, c.price, c.skuN])
    },
    skus: {
      title: 'SKUs', icon: '🏷️',
      desc: 'Synthetic SKU master (all products).',
      headers: ['SKU Code', 'Product', 'Category', 'Price (Rs)'],
      getRows: () => DB.skus.map(s => [s.code, s.name, DB.cats[s.cat].name, s.price])
    },
    stockouts: {
      title: 'Stock-out events', icon: '📉',
      desc: 'Store × category × day availability incidents with lost-sales estimate (current scope).',
      headers: ['Event ID', 'Date', 'City', 'Store Code', 'Category', 'SKU', 'SKUs Out', 'Hours Out', 'Lost Orders', 'Lost Revenue (Rs)'],
      getRows: (ctx) => ctx.soL.map(s => [s.id, DB.days[s.day].date, DB.cities[s.city].name, DB.stores[s.store].code, DB.cats[s.cat].name, s.sku + ' · ' + s.skuName, s.skus, s.hours, s.lostOrders, s.lostRev])
    },
    complaints: {
      title: 'Customer complaints', icon: '🗣️',
      desc: 'Complaint tickets with category (current scope).',
      headers: ['Complaint ID', 'Date', 'City', 'Store Code', 'Category', 'Order O2D (min)'],
      getRows: (ctx) => ctx.cmpL.map(c => [c.id, DB.days[c.day].date, DB.cities[c.city].name, DB.stores[c.store].code, DB.complaintCats[c.cat], Math.round(c.total)])
    },
    store_summary: {
      title: 'Store performance summary', icon: '📊',
      desc: 'Aggregated KPIs per store for the current filter scope.',
      headers: ['Store Code', 'Store Name', 'City', 'Zone', 'Orders', 'Delivered', 'Cancelled', 'Net Revenue (Rs)', 'AOV (Rs)', 'Avg Picking (min)', 'Avg Packing (min)', 'Avg Rider Assign (min)', 'Avg Delivery (min)', 'SLA %', 'Cancel %', 'Complaints', 'Status'],
      getRows: (ctx) => {
        const out = [];
        ctx.byStore.forEach((a, sid) => {
          const d = A().agg(a), s = DB.stores[sid];
          out.push([s.code, s.label, DB.cities[s.city].name, DB.cities[s.city].zones[s.zone], a.n, a.del, a.canc, a.rev, Math.round(d.aov), +d.avgPick.toFixed(2), +d.avgPack.toFixed(2), +d.avgAsg.toFixed(2), +d.avgTotal.toFixed(2), +d.slaPct.toFixed(1), +d.cancelRate.toFixed(1), a.cmp, A().storeStatus(d, a, ctx)]);
        });
        return out;
      }
    },
    daily_summary: {
      title: 'Daily operations summary', icon: '📅',
      desc: 'Day-by-day network aggregates for the current scope.',
      headers: ['Date', 'Orders', 'Delivered', 'Cancelled', 'GMV (Rs)', 'Net Revenue (Rs)', 'Avg Delivery (min)', 'SLA %', 'Cancel %', 'Complaints'],
      getRows: (ctx) => {
        const out = [];
        for (let d = ctx.from; d <= ctx.to; d++) {
          const a = ctx.byDay.get(d); if (!a) continue;
          const dd = A().agg(a);
          out.push([DB.days[d].date, a.n, a.del, a.canc, a.gmv, a.rev, +dd.avgTotal.toFixed(1), +dd.slaPct.toFixed(1), +dd.cancelRate.toFixed(1), a.cmp]);
        }
        return out;
      }
    }
  };

  /* --------------------------- all-data workbook -------------------------- */
  function fullWorkbookSheets(ctx) {
    const meta = {
      name: 'README',
      headers: ['Zepto Ops 360° — Synthetic Dataset Export'],
      rows: [
        ['Dataset', 'Synthetic demonstration data for a quick-commerce operations dashboard'],
        ['Disclaimer', '100% synthetic, locally generated. NOT real Zepto internal data. No real customers, riders, stores or transactions.'],
        ['Coverage', DB.meta.start + ' → ' + DB.meta.end + ' (' + DB.meta.nDays + ' days)'],
        ['Cities', DB.cities.map(c => c.name).join(', ')],
        ['Dark stores', DB.stores.length],
        ['Orders', DB.orders.length],
        ['Customers', DB.customers.length],
        ['Riders', DB.riders.length],
        ['SLA rule', 'Order-to-delivery within ' + DB.slaMin + ' minutes (target ≥ ' + DB.slaPct + '% compliance)'],
        ['Worksheets', 'Orders · SLA Breaches · Cancellations & Refunds · Stockouts · Complaints · Customers · Riders · Dark Stores · Cities · Categories · SKUs · Store Summary · Daily Summary'],
        ['Exported at', new Date().toLocaleString('en-IN')],
        ['Export scope note', 'The Orders / SLA / Stockouts / Complaints sheets in THIS export use the FULL 12-month dataset, independent of dashboard filters.']
      ]
    };
    const full = { cur: DB.orders, soL: DB.stockouts, cmpL: DB.complaints, from: 0, to: DB.meta.nDays - 1, byStore: A().groupAgg(DB.orders, o => o.store), byDay: A().groupAgg(DB.orders, o => o.day), len: DB.meta.nDays, k: null, d: null, soByStore: new Map(), cmpByStore: new Map(), };
    full.d = A().agg(A().aggregate(DB.orders, true));
    DB.stockouts.forEach(s => full.soByStore.set(s.store, (full.soByStore.get(s.store) || 0) + 1));
    return [
      meta,
      { name: 'Orders', headers: ORDER_HEADERS, rows: DB.orders.map(orderRow) },
      { name: 'SLA Breaches', headers: ORDER_HEADERS, rows: DB.orders.filter(o => o.sla).map(orderRow) },
      { name: 'Cancellations', headers: ORDER_HEADERS, rows: DB.orders.filter(o => o.status === 1 || o.ref > 0).map(orderRow) },
      { name: 'Stockouts', headers: DATASETS.stockouts.headers, rows: DB.stockouts.map(s => [s.id, DB.days[s.day].date, DB.cities[s.city].name, DB.stores[s.store].code, DB.cats[s.cat].name, s.sku + ' · ' + s.skuName, s.skus, s.hours, s.lostOrders, s.lostRev]) },
      { name: 'Complaints', headers: DATASETS.complaints.headers, rows: DB.complaints.map(c => [c.id, DB.days[c.day].date, DB.cities[c.city].name, DB.stores[c.store].code, DB.complaintCats[c.cat], Math.round(c.total)]) },
      { name: 'Customers', headers: DATASETS.customers.headers, rows: DATASETS.customers.getRows() },
      { name: 'Riders', headers: DATASETS.riders.headers, rows: DATASETS.riders.getRows() },
      { name: 'Dark Stores', headers: DATASETS.stores.headers, rows: DATASETS.stores.getRows() },
      { name: 'Cities', headers: DATASETS.cities.headers, rows: DATASETS.cities.getRows() },
      { name: 'Categories', headers: DATASETS.categories.headers, rows: DATASETS.categories.getRows() },
      { name: 'SKUs', headers: DATASETS.skus.headers, rows: DATASETS.skus.getRows() },
      { name: 'Store Summary', headers: DATASETS.store_summary.headers, rows: DATASETS.store_summary.getRows(full) },
      { name: 'Daily Summary', headers: DATASETS.daily_summary.headers, rows: (() => { const out = []; for (let d = 0; d < DB.meta.nDays; d++) { const a = full.byDay.get(d); if (!a) continue; const dd = A().agg(a); out.push([DB.days[d].date, a.n, a.del, a.canc, a.gmv, a.rev, +dd.avgTotal.toFixed(1), +dd.slaPct.toFixed(1), +dd.cancelRate.toFixed(1), a.cmp]); } return out; })() }
    ];
  }

  /* --------------------- per-table export buttons ------------------------- */
  function tableToAOA(tbl) {
    const rows = [];
    tbl.querySelectorAll('tr').forEach(tr => {
      const row = [];
      tr.querySelectorAll('th,td').forEach(td => row.push(td.textContent.replace(/\s+/g, ' ').trim()));
      if (row.length) rows.push(row);
    });
    return rows;
  }
  function attach(root) {
    if (!root) return;
    root.querySelectorAll('table.tbl').forEach(tbl => {
      if (tbl.dataset.exp) return;
      tbl.dataset.exp = '1';
      const bodyRows = tbl.querySelectorAll('tbody tr').length;
      if (bodyRows < 2) return;
      const host = tbl.closest('.tscroll') || tbl;
      if (host.dataset.expBar) return;
      host.dataset.expBar = '1';
      const bar = document.createElement('div');
      bar.className = 'texp';
      const btn = document.createElement('button');
      btn.className = 'texp-btn';
      btn.innerHTML = '⬇ Export table';
      btn.title = 'Download this table as CSV (Excel-friendly)';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const panel = tbl.closest('.panel,.drawer');
        const h3 = panel ? panel.querySelector('h3') : null;
        const name = (h3 ? h3.textContent : 'table').replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'table';
        const aoa = tableToAOA(tbl);
        exportCSV('ZeptoOps360_' + name, aoa[0], aoa.slice(1));
      });
      bar.appendChild(btn);
      host.parentNode.insertBefore(bar, host);
    });
  }

  return {
    exportCSV, exportWorkbook, attach, DATASETS, fullWorkbookSheets,
    zipStore, sheetXML, sstXML // exported for testing
  };
})();
