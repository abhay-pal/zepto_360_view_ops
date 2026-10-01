/* ============================================================================
 * data.js — Synthetic dataset generator for the Operations Director 360°
 * Command Center (demo/portfolio project).
 *
 * 100% SYNTHETIC, DETERMINISTICALLY GENERATED DEMO DATA.
 * This is NOT real Zepto internal data. No real customer names, phone
 * numbers or addresses are used. Everything is generated locally in the
 * browser with a seeded PRNG so the dataset is identical on every load.
 * ==========================================================================*/
(function () {
  'use strict';

  /* ------------------------------ RNG utilities -------------------------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rng = mulberry32(20261001);
  const R = () => rng();
  const rint = (a, b) => a + Math.floor(rng() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // Gaussian approx via Box–Muller
  function rnorm(mu, sigma) {
    let u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  const rlog = (mu, sigma) => Math.exp(rnorm(mu, sigma));
  function wpickIdx(weights) {           // returns index, weights need not sum to 1
    let s = 0; for (let i = 0; i < weights.length; i++) s += weights[i];
    let x = rng() * s;
    for (let i = 0; i < weights.length; i++) { x -= weights[i]; if (x <= 0) return i; }
    return weights.length - 1;
  }

  /* ------------------------------ Calendar ------------------------------- */
  const N_DAYS = 365;
  const DAY0 = new Date(2025, 9, 2, 0, 0, 0);          // 02-Oct-2025
  const dayDate = (d) => new Date(DAY0.getTime() + d * 864e5);
  const pad2 = (n) => (n < 10 ? '0' + n : '' + n);
  const dateStr = (d) => { const dt = dayDate(d); return dt.getFullYear() + '-' + pad2(dt.getMonth() + 1) + '-' + pad2(dt.getDate()); };
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const days = [];
  for (let d = 0; d < N_DAYS; d++) {
    const dt = dayDate(d), dow = dt.getDay(), m = dt.getMonth();
    // festival boost (Diwali week Oct-2025, NYE, Republic day sale etc.)
    let fest = 1.0;
    const mmdd = (dt.getMonth() + 1) * 100 + dt.getDate();
    if (mmdd >= 1012 && mmdd <= 1024) fest = mmdd >= 1011 && mmdd <= 1023 ? 1.14 : 1.06; // Diwali 2025
    if (mmdd === 1231 || mmdd === 101) fest = 1.12;
    if (mmdd === 314 || mmdd === 315) fest = 1.07;   // Holi
    if (mmdd === 815) fest = 0.9;                    // Independence day
    days.push({
      d, date: dateStr(d), dow, month: m,
      mk: dt.getFullYear() + '-' + pad2(dt.getMonth() + 1),
      label: MONTHS[m] + ' ' + dt.getDate(),
      wknd: (dow === 0 || dow === 6) ? 1 : 0,
      fest
    });
  }

  /* ---------------------------- Cities & stores -------------------------- */
  const CITIES = [
    { name: 'Delhi NCR', share: 0.195, zones: ['Gurgaon', 'Noida', 'South Delhi', 'Ghaziabad'], tier: 1 },
    { name: 'Mumbai', share: 0.185, zones: ['Andheri', 'Bandra', 'Thane', 'Navi Mumbai'], tier: 1 },
    { name: 'Bengaluru', share: 0.175, zones: ['Koramangala', 'Whitefield', 'HSR Layout', 'Indiranagar'], tier: 1 },
    { name: 'Hyderabad', share: 0.125, zones: ['Hitech City', 'Banjara Hills', 'Secunderabad', 'Kukatpally'], tier: 1 },
    { name: 'Chennai', share: 0.095, zones: ['Adyar', 'Velachery', 'Anna Nagar', 'OMR'], tier: 2 },
    { name: 'Pune', share: 0.09, zones: ['Baner', 'Hinjewadi', 'Kothrud', 'Viman Nagar'], tier: 2 },
    { name: 'Kolkata', share: 0.085, zones: ['Salt Lake', 'Park Street', 'New Town', 'Behala'], tier: 2 }
  ];
  const LOCALITIES = {
    'Delhi NCR': ['Sector 45', 'DLF Phase 2', 'Sector 62', 'Sector 18', 'Saket', 'Lajpat Nagar', 'Vaibhav Khand', 'Raj Nagar', 'Sohna Road', 'Crossing Republik', 'Rohini Sec 7', 'Dwarka Sec 6', 'Vasant Kunj', 'Noida Ext'],
    'Mumbai': ['Andheri West', 'Powai', 'Bandra West', 'Khar', 'Thane West', 'Ghodbunder Rd', 'Vashi', 'Koparkhairane', 'Malad West', 'Borivali', 'Chembur', 'Kandivali', 'Airoli'],
    'Bengaluru': ['HSR Sec 2', 'Koramangala 4th Blk', 'Whitefield Main', 'ITPL Rd', 'Indiranagar 100ft', 'BTM Layout', 'JP Nagar', 'Electronic City', 'Sarjapur Rd', 'Bellandur', 'Hebbal', 'Yelahanka'],
    'Hyderabad': ['Madhapur', 'Gachibowli', 'Kondapur', 'Banjara Hills Rd 12', 'Jubilee Hills', 'Secunderabad East', 'Kompally', 'Kukatpally HB', 'Miyapur', 'Manikonda'],
    'Chennai': ['AdyarLB', 'Thiruvanmiyur', 'Velachery Main', 'Perungudi', 'Anna Nagar West', 'Thoraipakkam', 'Sholinganallur', 'Porur'],
    'Pune': ['Baner Rd', 'Balewadi', 'Hinjewadi Ph 1', 'Wakad', 'Kothrud Depot Rd', 'Kharadi', 'Viman Nagar', 'Magarpatta'],
    'Kolkata': ['Salt Lake Sec V', 'Rajarhat', 'New Town AA1', 'Park Circus', 'Ballygunge', 'Behala Chowrasta', 'Gariahat']
  };
  const STORE_PER_CITY = [14, 13, 12, 10, 8, 8, 7]; // 72 stores

  const stores = [];
  let sIdx = 0;
  CITIES.forEach((c, ci) => {
    const n = STORE_PER_CITY[ci];
    let shares = []; let sum = 0;
    for (let i = 0; i < n; i++) { const v = rlog(0, 0.55); shares.push(v); sum += v; }
    const ccode = c.name.replace(/[^A-Z]/g, '').slice(0, 3).toUpperCase();
    for (let i = 0; i < n; i++) {
      const zone = i % 4;
      const perf = clamp(rnorm(1.0, 0.12), 0.78, 1.38);     // <1 fast, >1 slow
      const chronicShort = rng() < 0.16;                    // chronically short of riders
      const stockProp = clamp(rlog(0, 0.5) * (rng() < 0.12 ? 2.1 : 1), 0.4, 3.4);
      const volShare = shares[i] / sum;
      stores.push({
        id: sIdx, code: 'DS-' + pad2(ci + 1) + '-' + pad2(i + 1),
        name: LOCALITIES[c.name][i % LOCALITIES[c.name].length],
        label: LOCALITIES[c.name][i % LOCALITIES[c.name].length] + ' (' + c.zones[zone] + ')',
        city: ci, zone, share: volShare, perf,
        riderShort: chronicShort,
        stockProp,
        pickers: rint(4, 10), packers: rint(2, 6),
        staff: rint(3, 8),
        rentL: (c.tier === 1 ? rint(90, 160) : rint(55, 100)) / 100,  // ₹ lakh/month
        riderBase: 0 // filled below
      });
      sIdx++;
    }
  });
  /* ------------------------------- riders -------------------------------- */
  const riders = [];
  const storeRiders = stores.map(() => []);
  let rSeq = 700000;
  const SHIFT_STARTS = [6, 7, 8, 10, 14, 15, 16, 17];
  const SHIFT_W = [0.13, 0.10, 0.14, 0.10, 0.19, 0.15, 0.13, 0.06];
  stores.forEach(s => {
    const nR = Math.max(2, Math.round(s.share * CITIES[s.city].share * 175) + rint(0, 1));
    for (let i = 0; i < nR; i++) {
      const r = {
        id: 'RDR-' + (++rSeq), store: s.id, city: s.city,
        perf: clamp(rnorm(1, 0.14), 0.72, 1.35), join: rint(0, 300),
        roster: 0.48 + R() * 0.3,          // daily probability of being on shift
        shiftStart: SHIFT_STARTS[wpickIdx(SHIFT_W)]
      };
      storeRiders[s.id].push(riders.length); riders.push(r);
    }
  });
  // deterministic daily shift roster
  function riderOnShift(rIdx, day) {
    let h = (Math.imul(rIdx + 7, 2654435761)) ^ (Math.imul(day + 31, 2246822519));
    h = Math.imul(h ^ (h >>> 13), 3266489917);
    const u = ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    return u < riders[rIdx].roster;
  }
  function activeRiders(storeId, day) {
    const list = storeRiders[storeId]; const out = [];
    for (let i = 0; i < list.length; i++) if (riderOnShift(list[i], day)) out.push(list[i]);
    return out;
  }

  const ZONENAME = (store) => CITIES[store.city].zones[store.zone];

  /* ------------------------------ Categories ----------------------------- */
  const CATS = [
    { name: 'Fruits & Vegetables', share: 0.245, price: 55, skuN: 46 },
    { name: 'Dairy, Bread & Eggs', share: 0.165, price: 62, skuN: 38 },
    { name: 'Snacks & Munchies', share: 0.135, price: 38, skuN: 52 },
    { name: 'Beverages', share: 0.115, price: 58, skuN: 40 },
    { name: 'Bakery & Breakfast', share: 0.085, price: 45, skuN: 30 },
    { name: 'Household Essentials', share: 0.085, price: 95, skuN: 36 },
    { name: 'Personal Care', share: 0.065, price: 125, skuN: 32 },
    { name: 'Frozen & Instant', share: 0.055, price: 115, skuN: 28 },
    { name: 'Baby Care', share: 0.028, price: 190, skuN: 18 },
    { name: 'Pet Care', share: 0.022, price: 265, skuN: 16 }
  ];
  const SKU_WORDS = {
    'Fruits & Vegetables': ['Banana Robusta 500g', 'Tomato Desi 500g', 'Onion 1kg', 'Potato 1kg', 'Apple Shimla 4pc', 'Coriander Bunch', 'Spinach 250g', 'Green Chilli 100g', 'Cucumber 500g', 'Lemon 4pc', 'Ginger 100g', 'Carrot Orange 500g', 'Capsicum 2pc', 'Cauliflower 1pc', 'Mushroom 200g'],
    'Dairy, Bread & Eggs': ['Whole Milk 500ml', 'Toned Milk 1L', 'Curd Cup 400g', 'Paneer 200g', 'Butter 100g', 'Brown Bread 400g', 'White Bread 400g', 'Farm Eggs 6pc', 'Farm Eggs 12pc', 'Cheese Slices 200g', 'Ghee 500ml', 'Buttermilk 500ml', 'Cream 200ml', 'Flavoured Milk 180ml', 'Lassi 250ml'],
    'Snacks & Munchies': ['Potato Chips 150g', 'Salted Peanuts 200g', 'Namkeen Mix 400g', 'Cookies 300g', 'Chocolate Bar 50g', 'Instant Noodles 4pk', 'Popcorn Tub', 'Trail Mix 200g', 'Bhujia 400g', 'Rusk 200g', 'Protein Bar', 'Khakhra 200g'],
    'Beverages': ['Cola 750ml', 'Orange Juice 1L', 'Green Tea 25bags', 'Cold Coffee 250ml', 'Energy Drink 250ml', 'Sparkling Water 500ml', 'Iced Tea 500ml', 'Tender Coconut 1pc', 'Lassi Bottle 200ml', 'Masala Soda 300ml', 'Mineral Water 1L', 'Mango Drink 1L'],
    'Bakery & Breakfast': ['Multigrain Bread 400g', 'Croissant 2pc', 'Muffin 2pc', 'Pav 6pc', 'Oats 500g', 'Muesli 450g', 'Cornflakes 475g', 'Peanut Butter 350g', 'Jam 500g', 'Honey 500g', 'Poha Mix 200g', 'Upma Mix 200g'],
    'Household Essentials': ['Detergent 1kg', 'Dishwash Gel 500ml', 'Floor Cleaner 1L', 'Toilet Cleaner 500ml', 'Garbage Bags 30pc', 'Tissue Roll 4pc', 'Aluminium Foil 9m', 'Scrub Pads 3pc', 'Phenyl 1L', 'Mop Refill', 'Air Freshener 250ml', 'Matchbox 10pc'],
    'Personal Care': ['Shampoo 340ml', 'Body Wash 250ml', 'Toothpaste 200g', 'Face Wash 150ml', 'Moisturiser 200ml', 'Hand Sanitizer 200ml', 'Sanitary Pads 12pc', 'Razor 5pc', 'Hair Oil 300ml', 'Deodorant 150ml', 'Sunscreen SPF50 50ml', 'Lip Balm 10g'],
    'Frozen & Instant': ['Green Peas 500g', 'Chicken Nuggets 400g', 'Veg Burger Patty 4pc', 'French Fries 750g', 'Ice Cream Tub 700ml', 'Frozen Paratha 5pc', 'Sweet Corn 500g', 'Paneer Tikka 250g', 'Instant Soup 4pk', 'Ready Meal 300g'],
    'Baby Care': ['Diapers M 42pc', 'Diapers L 36pc', 'Baby Wipes 80pc', 'Baby Lotion 200ml', 'Baby Food Cereal 300g', 'Baby Shampoo 100ml', 'Diaper Rash Cream 50g', 'Baby Soap 75g'],
    'Pet Care': ['Dog Food Adult 3kg', 'Cat Food 2.5kg', 'Dog Treats 500g', 'Cat Litter 5kg', 'Pet Shampoo 500ml', 'Bird Seed Mix 1kg', 'Fish Food 200g', 'Puppy Food 2kg']
  };
  const skus = [];
  CATS.forEach((c, ci) => {
    c.skus = [];
    const words = SKU_WORDS[c.name];
    for (let i = 0; i < c.skuN; i++) {
      const nm = words[i % words.length] + (i >= words.length ? ' • Pack ' + (Math.floor(i / words.length) + 1) : '');
      const code = 'SKU-' + (ci + 1) + pad2(i + 1) + '-' + rint(100, 999);
      const o = { cat: ci, code, name: nm, price: Math.round(c.price * clamp(rlog(0, 0.4), 0.4, 2.6)) };
      c.skus.push(o); skus.push(o);
    }
  });

  /* ---------------------------- Reference data --------------------------- */
  const PAY_METHODS = ['UPI', 'Card', 'Cash on Delivery', 'Wallet'];
  const PAY_W = [0.56, 0.19, 0.15, 0.10];
  const SOURCES = ['Android App', 'iOS App', 'Web', 'Partner App'];
  const SRC_W = [0.62, 0.28, 0.07, 0.03];
  const STATUSES = ['Delivered', 'Cancelled', 'Returned', 'Refunded'];
  const CANCEL_REASONS = ['Customer Cancelled', 'Item Out of Stock', 'Store Delay', 'Rider Unavailable', 'Payment Failure', 'Delivery Delay', 'System Issue'];
  const CANCEL_W = [0.30, 0.24, 0.08, 0.13, 0.11, 0.11, 0.03];
  const DELAY_REASONS = ['High Order Volume', 'Store Capacity Issue', 'Picker Shortage', 'Picking Delay', 'Packing Delay', 'Rider Shortage', 'Rider Assignment Delay', 'Rider Waiting at Store', 'Traffic Congestion', 'Weather', 'Inventory Issue', 'System Issue', 'Customer Unavailable', 'Incorrect Address'];
  const COMPLAINT_CATS = ['Late Delivery', 'Missing Item', 'Wrong Item', 'Damaged Product', 'Quality Issue', 'Refund Issue', 'Delivery Partner Issue'];

  // hour-of-day demand weights (two peaks: morning 8-11, evening 18-22)
  const HOUR_W = [0.6, 0.3, 0.18, 0.12, 0.12, 0.3, 0.9, 2.4, 4.4, 5.6, 6.2, 5.6, 5.1, 4.6, 4.4, 4.6, 5.2, 6.3, 7.6, 8.6, 8.9, 7.4, 4.9, 2.2];
  (function () { let s = 0; HOUR_W.forEach(w => s += w); for (let i = 0; i < 24; i++) HOUR_W[i] /= s; })();
  const HOUR_CUM = []; { let c = 0; HOUR_W.forEach(w => { c += w; HOUR_CUM.push(c); }); }
  function pickHour() { const x = R(); for (let i = 0; i < 24; i++) if (x <= HOUR_CUM[i]) return i; return 23; }
  const DOW_W = [1.10, 0.92, 0.90, 0.91, 0.94, 1.06, 1.17]; // Sun..Sat

  const isPeak = (h) => (h >= 8 && h <= 11) || (h >= 18 && h <= 22);
  const peakMult = (h) => (h >= 19 && h <= 21) ? 1.55 : (isPeak(h) ? 1.3 : 1.0);

  /* ----------------------------- Order engine ---------------------------- */
  const orders = [];
  const complaints = [];
  const stockouts = [];
  const CUST_N = 36000;
  const firstDay = new Map();

  let orderSeq = 1000000, cmpSeq = 500000, soSeq = 900000;

  // per-(store,day) cache of category stockout flags for linking cancellations
  const soToday = new Map(); // key: store*400+day -> Set(cats)

  const perfCityBoost = [1.0, 1.02, 0.99, 0.97, 1.0, 1.01, 1.03];

  for (let d = 0; d < N_DAYS; d++) {
    const dy = days[d];
    const growth = Math.pow(1.05, d / 30.4);
    const baseN = Math.round(238 * growth * DOW_W[dy.dow] * dy.fest * rnorm(1, 0.05));
    // rain per city today (monsoon Jun–Sep heavier)
    const monsoon = (dy.month >= 5 && dy.month <= 8);
    const rain = CITIES.map(() => R() < (monsoon ? 0.30 : 0.045));

    soToday.clear();
    /* --- pre-generate stockout events for the day (all stores) --- */
    for (let s = 0; s < stores.length; s++) {
      const st = stores[s];
      for (let ci = 0; ci < CATS.length; ci++) {
        const p = 0.015 * st.stockProp * (monsoon && ci === 0 ? 1.5 : 1);
        if (R() < p) {
          const hoursOut = clamp(rlog(0.25, 0.6), 0.5, 6);
          const nSku = Math.min(CATS[ci].skuN, rint(1, 6));
          const skuObj = pick(CATS[ci].skus);
          const storeHrVol = 238 * growth * CITIES[st.city].share * st.share / 24;
          const lostOrders = Math.max(1, Math.round(hoursOut * storeHrVol * CATS[ci].share * 24 * 0.55 * rnorm(1, 0.2)));
          const lostRev = Math.round(lostOrders * CATS[ci].price * 4.4 * rnorm(1, 0.15));
          stockouts.push({
            id: 'SO-' + (++soSeq), day: d, store: s, city: st.city, cat: ci,
            skus: nSku, sku: skuObj.code, skuName: skuObj.name,
            hours: Math.round(hoursOut * 10) / 10, lostOrders, lostRev
          });
          const k = s * 400 + d;
          if (!soToday.has(k)) soToday.set(k, new Set());
          soToday.get(k).add(ci);
        }
      }
    }

    if (baseN <= 0) continue;

    for (let i = 0; i < baseN; i++) {
      const hour = pickHour();
      const minute = rint(0, 59);
      const t = d * 1440 + hour * 60 + minute;
      const city = wpickIdx(CITIES.map(c => c.share * perfCityBoost[CITIES.indexOf(c)]));
      const st = (function () { // pick store in city weighted by share
        const list = stores.filter(o => o.city === city);
        return list[wpickIdx(list.map(o => o.share))];
      })();
      const pm = st.perf * (rain[city] ? 1.12 : 1.0);
      const pk = peakMult(hour);
      const understaff = R() < (st.riderShort ? 0.35 : 0.12);

      const cusIdx = Math.min(CUST_N - 1, Math.floor((9000 + d * 74) * Math.pow(R(), 2.1)));
      if (!firstDay.has(cusIdx)) firstDay.set(cusIdx, d);

      const cat = wpickIdx(CATS.map((c, ci) => {
        let w = c.share;
        if (hour >= 6 && hour <= 10 && (ci === 1 || ci === 4)) w *= 1.5;   // breakfast skew
        if (hour >= 18 && hour <= 23 && (ci === 2 || ci === 3)) w *= 1.35;  // evening snacks
        return w;
      }));
      const items = clamp(Math.round(rlog(1.52, 0.55)), 1, 22);
      const itemPrice = CATS[cat].price * clamp(rlog(0, 0.32), 0.45, 2.2);
      const val = Math.round(items * itemPrice * (items > 6 ? 1.05 : 1));
      const disc = R() < 0.62 ? Math.round(val * Math.pow(R(), 2) * 0.13) : 0;
      const fee = val >= 499 ? 0 : (R() < 0.12 ? 0 : rint(15, 29));
      const rev = val - disc + fee;
      const pay = wpickIdx(PAY_W);
      const src = wpickIdx(SRC_W);

      /* -------- timestamps (minutes since DAY0) --------
         Real quick-commerce flow: rider is assigned right after store
         accepts, travels to the store WHILE the order is picked/packed,
         then waits at the store until dispatch.                        */
      const rAv = (st.riderShort ? 2.1 : 1.0) * (understaff ? 1.7 : 1) * (pk >= 1.3 ? 1.4 : 1);
      const acc = t + clamp(rlog(-0.55, 0.5), 0.2, 6) * pm;
      const asgD = clamp(rlog(0.25, 0.7), 0.2, 16) * rAv;          // rider assignment after accept
      const rAsg = acc + asgD;
      const rArr = rAsg + clamp(rlog(0.5, 0.55), 0.3, 10);         // rider travel to store
      const pickS = acc + clamp(rlog(-0.15, 0.6), 0.1, 9) * pm * (pk > 1.3 ? 1.5 : 1);
      const pickD = (1.0 + items * 0.30) * clamp(rlog(0, 0.27), 0.5, 2.6) * pm * (pk > 1.3 ? 1.25 : 1);
      const pickE = pickS + pickD;
      const packD = clamp(rlog(0.1, 0.4), 0.3, 5) * pm;
      const packE = pickE + packD;
      const disp = Math.max(rArr, packE) + clamp(rlog(-1.0, 0.5), 0.1, 2.5);
      const dist = clamp(rlog(0.72, 0.42), 0.7, 4.5);
      let speed = rnorm(21.5, 2.6);
      if (hour >= 17 && hour <= 20) speed *= 0.8;
      if (rain[city]) speed *= 0.85;
      speed = clamp(speed, 10, 28);
      const ride = dist / speed * 60;
      const del = disp + ride;

      /* ---------------- status / cancellation ---------------- */
      const cancelP = 0.056 * (rain[city] ? 1.25 : 1) * (st.stockProp > 1.6 ? 1.3 : 1);
      let status = 0, cr = -1, refAmt = 0;
      let fAcc = acc, fPickS = pickS, fPickE = pickE, fPackE = packE, fRAsg = rAsg, fRArr = rArr, fDisp = disp, fDel = del;
      const rr = R();
      let paySt = (pay === 2 ? 0 : 0); // 0 Paid
      if (rr < cancelP) {
        status = 1;
        cr = wpickIdx(CANCEL_W.map((w, wi) => wi === 1 && soToday.get(st.id * 400 + d) && soToday.get(st.id * 400 + d).has(cat) ? w * 2.4 : w));
        if (cr === 4) { // payment failure — dies at placement
          fAcc = fPickS = fPickE = fPackE = fRAsg = fRArr = fDisp = fDel = -1; paySt = 2;
        } else if (cr === 0) { const cAt = t + clamp(rlog(0.6, 0.5), 1, 6); if (cAt < acc) { fAcc = -1; } fPickS = fPickE = fPackE = fRAsg = fRArr = fDisp = fDel = -1; if (cr === 0 && pay !== 2) { paySt = 1; refAmt = rev; } }
        else if (cr === 1) { fPickE = fPackE = fRAsg = fRArr = fDisp = fDel = -1; paySt = pay === 2 ? 0 : 1; refAmt = pay === 2 ? 0 : rev; }
        else if (cr === 2) { fPackE = fRAsg = fRArr = fDisp = fDel = -1; paySt = pay === 2 ? 0 : 1; refAmt = pay === 2 ? 0 : rev; }
        else if (cr === 3) { fRAsg = fRArr = fDisp = fDel = -1; paySt = pay === 2 ? 0 : 1; refAmt = pay === 2 ? 0 : rev; }
        else if (cr === 5) { fDel = -1; fDisp = disp; paySt = pay === 2 ? 0 : 1; refAmt = pay === 2 ? 0 : rev; }
        else { fAcc = fPickS = fPickE = fPackE = fRAsg = fRArr = fDisp = fDel = -1; }
      } else if (rr < cancelP + 0.012) { // returned after delivery
        status = 2; refAmt = rev; paySt = 1;
      } else if (R() < 0.042) { // delivered with partial/full refund
        status = 3; refAmt = Math.round(rev * clamp(rlog(-1, 0.5), 0.15, 1)); paySt = 1;
      }
      if (status === 0 && pay === 2) paySt = 0; // COD collected

      const total = (status === 0 || status === 3 || status === 2) ? (fDel - t) : -1;
      const slaBreach = (status === 0 || status === 3) && total > 20 ? 1 : 0;

      /* ------------------- delay root cause assignment ------------------- */
      let dReason = -1, dStage = -1;
      if (slaBreach || (status === 1 && cr === 5)) {
        const q = [
          { st: 3, ex: (fPickE - fPickS) - 3.6 },        // picking
          { st: 4, ex: (fPackE - fPickE) - 2.2 },        // packing
          { st: 6, ex: (fRAsg - fAcc) - 3.0 },           // assignment
          { st: 7, ex: (fDisp - fRArr) - 3.2 },          // rider waiting
          { st: 8, ex: ride - 9 }                        // last mile
        ];
        q.sort((a, b) => b.ex - a.ex);
        const top = q[0];
        if (top.st === 3) { dStage = 3; dReason = understaff ? 2 : (pk > 1.3 ? (R() < 0.5 ? 0 : 1) : 3); }
        else if (top.st === 4) { dStage = 4; dReason = pk > 1.3 && R() < 0.4 ? 0 : 4; }
        else if (top.st === 6) { dStage = 6; dReason = st.riderShort ? 5 : (R() < 0.55 ? 6 : 5); }
        else if (top.st === 7) { dStage = 7; dReason = 7; }
        else {
          dStage = 8;
          if (rain[city] && R() < 0.55) dReason = 9;
          else if (hour >= 17 && hour <= 21 && R() < 0.6) dReason = 8;
          else dReason = R() < 0.5 ? 12 : 13;
        }
        if (R() < 0.05 && soToday.get(st.id * 400 + d) && soToday.get(st.id * 400 + d).size) dReason = 10;
        if (R() < 0.03) dReason = 11;
      }

      // rider assignment — pick from today's rostered riders at that store
      const roster = activeRiders(st.id, d);
      const riderId = roster.length ? pick(roster) : pick(storeRiders[st.id]);

      /* ---------------- complaints (delivered orders) ---------------- */
      let cmpCat = -1;
      if (status === 0 || status === 3) {
        const cp = 0.015 + (slaBreach ? 0.058 : 0) + (status === 3 ? 0.05 : 0);
        if (R() < cp) {
          cmpCat = wpickIdx([slaBreach ? 0.46 : 0.20, 0.15, 0.10, 0.11, 0.13, status === 3 ? 0.12 : 0.04, 0.07]);
          complaints.push({ id: 'CMP-' + (++cmpSeq), day: d, cat: cmpCat, city, store: st.id, oId: orderSeq + 1, total: total });
        }
      }

      orders.push({
        id: 'O-' + (++orderSeq), t, day: d, h: hour, m: minute, dow: dy.dow,
        cus: cusIdx, city, store: st.id, cat, items,
        val, disc, fee, rev, pay, paySt, status, src, cr,
        n: firstDay.get(cusIdx) === d ? 1 : 0,
        acc: fAcc, pkS: fPickS, pkE: fPickE, pkF: fPackE, rAs: fRAsg, rAr: fRArr, ds: fDisp, del: fDel,
        total: total, sla: slaBreach, dR: dReason, rider: riderId, ref: refAmt, cmp: cmpCat,
        dist: Math.round(dist * 10) / 10
      });
    }
  }

  /* ----------------------------- customers ------------------------------- */
  const customers = [];
  const custAgg = new Map();
  for (let i = 0; i < orders.length; i++) {
    const o = orders[i];
    if (!custAgg.has(o.cus)) custAgg.set(o.cus, { n: 0, spend: 0, first: o.day, last: o.day, city: o.city });
    const a = custAgg.get(o.cus);
    a.n++; if (o.status !== 1) a.spend += o.rev;
    if (o.day < a.first) a.first = o.day;
    if (o.day > a.last) a.last = o.day;
  }
  custAgg.forEach((a, idx) => {
    customers.push({
      id: 'C' + (100001 + idx), firstDay: a.first, city: a.city,
      orders: a.n, spend: a.spend, seg: a.n >= 12 ? 'Power' : a.n >= 4 ? 'Regular' : 'Occasional'
    });
  });

  /* ---------------------------- (riders already generated above) ---------- */

  /* ------------------------------ finalize ------------------------------- */
  const SLA_TARGET_MIN = 20, SLA_TARGET_PCT = 90;

  window.DB = {
    meta: {
      label: 'SYNTHETIC DEMO DATASET — generated locally, not real Zepto internal data',
      start: days[0].date, end: days[N_DAYS - 1].date, nDays: N_DAYS,
      stores: stores.length, cities: CITIES.length, skus: skus.length
    },
    days, cities: CITIES, zones: CITIES.map(c => c.zones), stores, cats: CATS, skus,
    orders, customers, riders, complaints, stockouts, storeRiders, riderOnShift,
    payMethods: PAY_METHODS, sources: SOURCES, statuses: STATUSES,
    cancelReasons: CANCEL_REASONS, delayReasons: DELAY_REASONS, complaintCats: COMPLAINT_CATS,
    hourW: HOUR_W, slaMin: SLA_TARGET_MIN, slaPct: SLA_TARGET_PCT,
    zoneName: (s) => ZONENAME(stores[s])
  };
})();
