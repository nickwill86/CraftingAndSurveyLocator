/* =========================================================================
   NickWIll86's Just For Fun Crafting Simulator — UI
   ========================================================================= */
'use strict';

/* ------------------------------ helpers -------------------------------- */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const fmt = (v, prec) => {
  if (v === undefined || v === null || isNaN(v)) return '--';
  const p = (prec % 10) || 0;
  return p > 0 ? v.toFixed(Math.min(p, 2)) : String(Math.round(v));
};
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.style.display = 'block';
  clearTimeout(toast._t); toast._t = setTimeout(() => t.style.display = 'none', 2600);
}

/* attribute display names */
function attrName(a) {
  const S = window.SWG_STRINGS;
  if (S.attrNames[a]) return S.attrNames[a];
  const k = Object.keys(S.attrNames).find(k => k.endsWith('.' + a) || k.endsWith(':' + a));
  if (k) return S.attrNames[k];
  return a.replace(/^res_/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
function expGroupName(g) {
  const S = window.SWG_STRINGS;
  if (S.expNames[g]) return S.expNames[g];
  return g.replace(/^exp[_]?/i, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
function slotDisplayName(stfFile, key) {
  const S = window.SWG_STRINGS;
  const tbl = S.slotNames[stfFile];
  if (tbl && tbl[key]) return tbl[key];
  for (const f in S.slotNames) if (S.slotNames[f][key]) return S.slotNames[f][key];
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const RES_ATTRS = ['res_cold_resist','res_conductivity','res_decay_resist','res_flavor','res_heat_resist',
  'res_malleability','res_potential_energy','res_quality','res_shock_resistance','res_toughness'];
const RES_ATTR_SHORT = { res_cold_resist:'CR', res_conductivity:'CD', res_decay_resist:'DR', res_flavor:'FL',
  res_heat_resist:'HR', res_malleability:'MA', res_potential_energy:'PE', res_quality:'OQ',
  res_shock_resistance:'SR', res_toughness:'UT', res_entangle_resistance:'ER' };

const PLANETS = ['corellia','dantooine','dathomir','endor','lok','naboo','rori','talus','tatooine','yavin4'];
const PLANET_NAMES = { corellia:'Corellia', dantooine:'Dantooine', dathomir:'Dathomir', endor:'Endor',
  lok:'Lok', naboo:'Naboo', rori:'Rori', talus:'Talus', tatooine:'Tatooine', yavin4:'Yavin IV' };

/* Crafting tool tab bits -> profession tab definitions */
const PROFESSIONS = [
  { id:'artisan',      label:'Artisan / General', tabs:[1,4,8,16,128,256,512,1024,2048,65536,131072,262144], skillPrefix:['crafting_artisan'] },
  { id:'weaponsmith',  label:'Weaponsmith',       tabs:[1],       skillPrefix:['crafting_weaponsmith','crafting_artisan'] },
  { id:'armorsmith',   label:'Armorsmith',        tabs:[2],       skillPrefix:['crafting_armorsmith','crafting_artisan'] },
  { id:'chef',         label:'Chef',              tabs:[4],       skillPrefix:['crafting_chef','crafting_artisan'] },
  { id:'tailor',       label:'Tailor',            tabs:[8],       skillPrefix:['crafting_tailor','crafting_artisan'] },
  { id:'architect',    label:'Architect',         tabs:[512,1024],skillPrefix:['crafting_architect','crafting_artisan'] },
  { id:'droidengineer',label:'Droid Engineer',    tabs:[16,128],  skillPrefix:['crafting_droidengineer','crafting_artisan'] },
  { id:'bioengineer',  label:'Bio-Engineer',      tabs:[32,64],   skillPrefix:['outdoors_bio_engineer','crafting_artisan'] },
  { id:'shipwright',   label:'Shipwright',        tabs:[4096,8192,16384,32768,131072], skillPrefix:['crafting_shipwright','crafting_artisan'] },
];

/* which schematics belong to a profession: via skills SCHEMATICS_GRANTED */
function schematicsForProfession(prof) {
  const groups = new Set();
  for (const sk of window.SWG_SKILLS) {
    if (prof.skillPrefix.some(p => sk.name.startsWith(p))) sk.schem.forEach(g => groups.add(g));
  }
  const iffs = new Set();
  for (const g of groups) (window.SWG_SCHEM_GROUPS[g] || []).forEach(s => iffs.add(s));
  const list = window.SWG_SCHEMATICS.filter(s => iffs.has(s.id));
  // also include by tool tab for anything the groups missed
  const byTab = window.SWG_SCHEMATICS.filter(s => prof.tabs.includes(s.tab) && !iffs.has(s.id));
  return { granted: list, extra: byTab };
}

/* max skill mods per profession (sum every box in the profession trees) */
function maxedSkillMods(prof) {
  const mods = {};
  for (const sk of window.SWG_SKILLS) {
    if (prof.skillPrefix.some(p => sk.name.startsWith(p))) {
      for (const m in sk.mods) {
        const v = parseInt(sk.mods[m], 10) || 0;
        mods[m] = (mods[m] || 0) + v;
      }
    }
  }
  return mods;
}

/* ------------------------------ app state ------------------------------ */
const State = {
  inventory: [],           // {uid, kind:'resource'|'component', resource?, loot?, rolled?, qty, name}
  uidSeq: 1,
  currentProf: PROFESSIONS[1],
  currentSchematic: null,
  craft: null,             // active crafting session
  buffs: {
    attachments: true,     // +25 assembly & experimentation (wearable cap)
    bespinPort: true,      // +12 experiment bonus (max crafted)
    pyollianCake: true,    // +10 craft bonus (max crafted)
    tool: 15,              // crafting tool effectiveness (max crafted +15)
    luck: 0,
    manualAssembly: null,  // manual override
    manualExperimentation: null,
  },
  map: { planet:'naboo', resource:null, seed:1337, density:null, conc:2, marker:null, filter:'' },
};

function crafterStats(sch) {
  const prof = State.currentProf;
  const mods = maxedSkillMods(prof);
  const aSkillName = sch ? sch.assemblySkill : 'general_assembly';
  const eSkillName = sch ? sch.expSkill : 'general_experimentation';
  let assembly = mods[aSkillName] || 0;
  let exper = mods[eSkillName] || 0;
  if (State.buffs.manualAssembly !== null) assembly = State.buffs.manualAssembly;
  if (State.buffs.manualExperimentation !== null) exper = State.buffs.manualExperimentation;
  if (State.buffs.attachments) { assembly += 25; exper += 25; } // wearable cap ±25 (skill_mod_manager.lua)
  return {
    assemblySkill: assembly,
    experimentationSkill: exper,
    toolEffectiveness: State.buffs.tool,
    foodCraftBonus: State.buffs.pyollianCake ? 10 : 0,   // Pyollian Cake nutritionMax = 10
    foodExperimentBonus: State.buffs.bespinPort ? 12 : 0, // Bespin Port nutritionMax = 12
    luck: State.buffs.luck,
    aSkillName, eSkillName
  };
}

/* ======================================================================
   MAP TAB
   ====================================================================== */
const MapUI = {
  init() {
    const psel = $('#map-planet');
    PLANETS.forEach(p => psel.append(el('option','',PLANET_NAMES[p])));
    psel.addEventListener('change', () => { State.map.planet = PLANETS[psel.selectedIndex]; MapUI.loadPlanet(); });
    psel.selectedIndex = PLANETS.indexOf(State.map.planet);

    $('#map-res-filter').addEventListener('input', e => { State.map.filter = e.target.value.toLowerCase(); MapUI.renderResList(); });
    $('#map-seed').addEventListener('change', e => { State.map.seed = (parseInt(e.target.value,10)||0)>>>0; MapUI.renderOverlay(); });
    $('#map-reroll').addEventListener('click', () => {
      State.map.seed = Math.floor(Math.random() * 0xffffffff) >>> 0;
      $('#map-seed').value = State.map.seed;
      State.map.density = null;
      MapUI.renderOverlay();
    });
    $('#map-conc').addEventListener('change', () => { State.map.density = null; MapUI.renderOverlay(); });
    $('#survey-skill').addEventListener('change', () => MapUI.updateSampleInfo());
    $('#map-sample').addEventListener('click', () => MapUI.doSample());

    const hit = $('#map-hit');
    hit.addEventListener('mousemove', e => MapUI.hover(e));
    hit.addEventListener('click', e => MapUI.click(e));
    this.loadPlanet();
    this.renderResList();
    $('#map-seed').value = State.map.seed;
  },

  loadPlanet() {
    $('#map-img').src = 'maps/' + State.map.planet + '.webp';
    State.map.marker = null;
    $('#map-marker') && $('#map-marker').remove();
    this.renderResList();
    this.renderOverlay();
  },

  planetResources() {
    const p = State.map.planet;
    return window.SWG_RESOURCES.filter(r => r.z === p || r.z === '');
  },

  renderResList() {
    const wrap = $('#map-res-list'); wrap.innerHTML = '';
    const f = State.map.filter;
    let list = this.planetResources();
    if (f) list = list.filter(r => r.n.toLowerCase().includes(f) || r.c.join(' ').toLowerCase().includes(f) || r.t.includes(f));
    list.slice(0, 400).forEach(r => {
      const d = el('div','res-item');
      d.innerHTML = '<span class="nm">' + esc(r.n) + '</span> <span class="cls">' + esc(r.c[r.c.length-1] || '') + (r.z ? ' · ' + esc(PLANET_NAMES[r.z]||r.z) : ' · all planets') + '</span>';
      if (State.map.resource && State.map.resource.n === r.n) d.classList.add('sel');
      d.addEventListener('click', () => { State.map.resource = r; State.map.density = null; MapUI.renderResList(); MapUI.renderOverlay(); MapUI.renderResInfo(); });
      wrap.append(d);
    });
    $('#map-res-count').textContent = list.length + ' spawnable here';
  },

  currentMap() {
    const r = State.map.resource;
    if (!r) return null;
    if (State.map.density === null) {
      const concSel = $('#map-conc').value;
      let conc;
      if (concSel === 'auto') conc = concentrationClass(r.ct, false);
      else conc = parseInt(concSel, 10);
      State.map.conc = conc;
      State.map.density = SpawnDensityMap.rollDensity(conc);
    }
    return new SpawnDensityMap(State.map.seed, isOreResource(r.ct), State.map.density);
  },

  renderOverlay() {
    const cnv = $('#map-overlay');
    const ctx = cnv.getContext('2d');
    const N = 256;
    cnv.width = N; cnv.height = N;
    ctx.clearRect(0, 0, N, N);
    const m = this.currentMap();
    this.renderResInfo();
    if (!m) return;
    const img = ctx.createImageData(N, N);
    let px = 0;
    for (let iy = 0; iy < N; iy++) {
      const wy = ZONE_MAX - (iy + 0.5) * (16384 / N);   // screen top = +8192 (north)
      for (let ix = 0; ix < N; ix++, px += 4) {
        const wx = ZONE_MIN + (ix + 0.5) * (16384 / N);
        const d = m.getDensityAt(wx, wy);
        const c = MapUI.colorFor(d);
        img.data[px] = c[0]; img.data[px+1] = c[1]; img.data[px+2] = c[2]; img.data[px+3] = c[3];
      }
    }
    ctx.putImageData(img, 0, 0);
    $('#map-density-note').innerHTML =
      'Spawn max density: <b class="cyan">' + Math.round(State.map.density * 100) + '%</b> (' +
      ['','high','medium','low'][State.map.conc] + ' concentration class) · noise seed <b class="cyan">' + State.map.seed + '</b>';
    this.updateSampleInfo();
  },

  colorFor(d) {
    if (d <= 0.001) return [0, 0, 0, 0];
    const stops = [
      [0.00, [18, 40, 110, 40]],
      [0.15, [18, 58, 138, 90]],
      [0.40, [30, 143, 176, 120]],
      [0.65, [79, 232, 110, 140]],
      [0.82, [232, 229, 86, 160]],
      [1.00, [232, 92, 92, 185]]
    ];
    for (let i = 1; i < stops.length; i++) {
      if (d <= stops[i][0]) {
        const [d0, c0] = stops[i-1], [d1, c1] = stops[i];
        const t = (d - d0) / (d1 - d0);
        return c0.map((v, k) => Math.round(v + (c1[k] - v) * t));
      }
    }
    return stops[stops.length-1][1];
  },

  screenToWorld(e) {
    const r = e.target.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width;
    const fy = (e.clientY - r.top) / r.height;
    return { x: ZONE_MIN + fx * 16384, y: ZONE_MAX - fy * 16384, fx, fy };
  },

  hover(e) {
    const w = this.screenToWorld(e);
    const m = this.currentMap();
    let txt = Math.round(w.x) + ', ' + Math.round(w.y);
    if (m) txt += ' — ' + (m.getDensityAt(w.x, w.y) * 100).toFixed(1) + '%';
    $('#map-coords').textContent = txt;
  },

  click(e) {
    const w = this.screenToWorld(e);
    State.map.marker = w;
    let mk = $('#map-marker');
    if (!mk) { mk = el('div','map-marker'); mk.id = 'map-marker'; $('#map-stack').append(mk); }
    mk.style.left = (w.fx * 100) + '%';
    mk.style.top = (w.fy * 100) + '%';
    this.updateSampleInfo();
  },

  updateSampleInfo() {
    const box = $('#sample-info');
    const m = this.currentMap();
    const mk = State.map.marker;
    if (!m || !mk) { box.innerHTML = '<span class="muted">Pick a resource and click the map to set your sampling spot.</span>'; return; }
    const d = m.getDensityAt(mk.x, mk.y);
    const skill = parseInt($('#survey-skill').value, 10) || 0;
    const threshold = 32 - (Math.trunc(skill / 20) * 6);
    const canSample = d >= 0.10 && (d * 100) >= threshold;
    const avgMax = d * 26.5;
    const avgUnits = Math.trunc(avgMax * (skill / 100));
    box.innerHTML =
      '<div class="attr-line"><span class="an">Location</span><span class="av">' + Math.round(mk.x) + ', ' + Math.round(mk.y) + '</span></div>' +
      '<div class="attr-line"><span class="an">Concentration here</span><span class="av ' + (d >= 0.5 ? 'green' : d >= 0.1 ? '' : 'red') + '">' + (d*100).toFixed(1) + '%</span></div>' +
      '<div class="attr-line"><span class="an">Skill threshold</span><span class="av">' + threshold + '% min density</span></div>' +
      '<div class="attr-line"><span class="an">Can hand sample?</span><span class="av ' + (canSample ? 'green' : 'red') + '">' + (canSample ? 'Yes' : 'No') + '</span></div>' +
      '<div class="attr-line"><span class="an">Avg units per pull</span><span class="av">~' + avgUnits + '</span></div>';
  },

  doSample() {
    const m = this.currentMap();
    const mk = State.map.marker;
    if (!m || !mk) { toast('Pick a resource and click the map first.'); return; }
    const d = m.getDensityAt(mk.x, mk.y);
    const skill = parseInt($('#survey-skill').value, 10) || 0;
    const res = handSample(d, skill, {});
    const log = $('#sample-log');
    const line = el('div', res.success ? 'green' : 'red', '&gt; ' + esc(res.messages.join(' ')));
    log.prepend(line);
    while (log.children.length > 8) log.lastChild.remove();
    if (res.success && State.map.resource) {
      Inventory.addResource(State.map.resource, res.units);
      toast('+' + res.units + ' units of ' + State.map.resource.n + ' added to inventory');
    }
  },

  renderResInfo() {
    const box = $('#map-res-info');
    const r = State.map.resource;
    if (!r) { box.innerHTML = '<span class="muted">No resource selected.</span>'; return; }
    box.innerHTML = '';
    box.append(el('div', 'gold', esc(r.n)));
    box.append(el('div', 'small muted', esc(r.c.join(' › '))));
    const caps = ResourceDB.capsFor(r);
    RES_ATTRS.concat(['res_entangle_resistance']).forEach(a => {
      if (!(a in r.a)) return;
      const v = r.a[a];
      const cap = caps[a] || [1, 1000];
      const pctOfCap = cap[1] > cap[0] ? (v - cap[0]) / (cap[1] - cap[0]) : 1;
      const row = el('div','statbar');
      row.innerHTML = '<span class="lbl">' + (RES_ATTR_SHORT[a]||a) + '</span>' +
        '<span class="bar"><span class="fill ' + (v >= cap[1] ? 'max' : pctOfCap > 0.85 ? 'hi' : '') + '" style="width:' + Math.max(2, Math.min(100, v/10)) + '%"></span></span>' +
        '<span class="val">' + v + ' <span class="muted">/ ' + cap[1] + '</span></span>';
      box.append(row);
    });
    const best = Analyzer.bestUses(r).slice(0, 6);
    if (best.length) {
      box.append(el('h3','','Best used for'));
      best.forEach(b => {
        const d = el('div','attr-line');
        d.innerHTML = '<span class="an">' + esc(b.name) + '</span><span class="av">' + b.score.toFixed(0) + '</span>';
        box.append(d);
      });
    }
  }
};

/* ======================================================================
   RESOURCE DB (browse + caps + best uses)
   ====================================================================== */
const ResourceDB = {
  _capCache: {},
  capsFor(r) {
    const key = r.t;
    if (this._capCache[key]) return this._capCache[key];
    // find deepest tree row matching the resource's type chain
    let row = window.SWG_TREE.find(t => t.enum === r.t);
    if (!row) for (let i = r.ct.length - 1; i >= 0 && !row; i--) row = window.SWG_TREE.find(t => t.enum === r.ct[i]);
    const caps = {};
    if (row) {
      for (const a in row.attrs) {
        const nm = a.startsWith('res_') ? a : 'res_' + a;
        caps[nm.toLowerCase()] = row.attrs[a];
      }
    }
    this._capCache[key] = caps;
    return caps;
  },

  init() {
    $('#res-search').addEventListener('input', () => this.render());
    $('#res-planet').append(el('option','','All planets'));
    PLANETS.forEach(p => $('#res-planet').append(el('option','',PLANET_NAMES[p])));
    $('#res-planet').addEventListener('change', () => this.render());
    this.render();
  },

  render() {
    const q = $('#res-search').value.toLowerCase();
    const pidx = $('#res-planet').selectedIndex;
    const planet = pidx <= 0 ? null : PLANETS[pidx - 1];
    let list = window.SWG_RESOURCES;
    if (planet) list = list.filter(r => r.z === planet || r.z === '');
    if (q) list = list.filter(r => r.n.toLowerCase().includes(q) || r.c.join(' ').toLowerCase().includes(q) || r.t.includes(q));
    $('#res-total').textContent = list.length + ' resources';
    const tbody = $('#res-table tbody'); tbody.innerHTML = '';
    list.slice(0, 300).forEach(r => {
      const tr = document.createElement('tr');
      const caps = this.capsFor(r);
      const cells = RES_ATTRS.map(a => {
        if (!(a in r.a)) return '<td class="muted">--</td>';
        const v = r.a[a], cap = caps[a];
        const isMax = cap && v >= cap[1];
        const isHi = cap && (v - cap[0]) / Math.max(1, cap[1] - cap[0]) > 0.85;
        return '<td class="' + (isMax ? 'gold' : isHi ? 'green' : '') + '">' + v + '</td>';
      }).join('');
      tr.innerHTML = '<td class="cyan">' + esc(r.n) + '</td><td class="muted small">' + esc(r.c[r.c.length-1]||'') + '</td>' +
        '<td class="muted small">' + (r.z ? esc(PLANET_NAMES[r.z]||r.z) : 'All') + '</td>' + cells;
      tr.style.cursor = 'pointer';
      tr.addEventListener('click', () => {
        State.map.resource = r;
        if (r.z) { State.map.planet = r.z; $('#map-planet').selectedIndex = PLANETS.indexOf(r.z); MapUI.loadPlanet(); }
        State.map.density = null;
        switchTab('map');
        MapUI.renderResList(); MapUI.renderOverlay(); MapUI.renderResInfo();
      });
      tbody.append(tr);
    });
  }
};

/* ======================================================================
   ANALYZER — which schematics benefit most from a resource
   ====================================================================== */
const Analyzer = {
  bestUses(r) {
    const out = [];
    for (const sch of window.SWG_SCHEMATICS) {
      if (!sch.nExp || !sch.slotRes) continue;
      // resource must fit at least one slot class
      const fitsSlot = sch.slotRes.some(rt => !rt.includes('/') && (r.ct.includes(rt) || r.c.map(c=>c.toLowerCase().replace(/ /g,'_')).includes(rt)));
      if (!fitsSlot) continue;
      const weights = buildResourceWeights(sch);
      let score = 0, lines = 0;
      for (const rw of weights) {
        if (rw.filler) continue;
        let s = 0;
        for (const p of rw.props) {
          const a = PROP_ATTR[p.code];
          if (a && r.a[a]) s += r.a[a] * p.pct;
        }
        if (s > 0) { score += s; lines++; }
      }
      if (lines > 0) out.push({ name: sch.name, id: sch.id, score: score / lines });
    }
    out.sort((a, b) => b.score - a.score);
    return out;
  }
};

/* ======================================================================
   INVENTORY
   ====================================================================== */
const Inventory = {
  init() {
    $('#inv-add-resource').addEventListener('click', () => this.openResourcePicker());
    $('#inv-add-loot').addEventListener('click', () => this.openLootPicker());
    $('#inv-clear').addEventListener('click', () => { if (confirm('Clear entire inventory?')) { State.inventory = []; this.render(); } });
    this.render();
  },

  addResource(r, qty) {
    const existing = State.inventory.find(i => i.kind === 'resource' && i.resource.n === r.n);
    if (existing) existing.qty += qty;
    else State.inventory.push({ uid: State.uidSeq++, kind: 'resource', resource: r, qty, name: r.n });
    this.render();
  },

  addLoot(item, rolled) {
    State.inventory.push({
      uid: State.uidSeq++, kind: 'component', loot: item, rolled, qty: 1,
      name: item.name + (rolled.tierName ? ' (' + rolled.tierName + ')' : '')
    });
    this.render();
  },

  remove(uid) {
    State.inventory = State.inventory.filter(i => i.uid !== uid);
    this.render();
  },

  iconFor(item) {
    if (item.kind === 'resource') {
      const t = item.resource.ct;
      if (hasType(t, 'metal')) return '⛏️';
      if (hasType(t, 'ore')) return '🪨';
      if (hasType(t, 'chemical') || hasType(t, 'water') || hasType(t,'gas')) return '🧪';
      if (hasType(t, 'flora_resources')) return '🌿';
      if (hasType(t, 'creature_resources')) return '🍖';
      if (hasType(t, 'energy')) return '⚡';
      return '📦';
    }
    return '🔧';
  },

  render() {
    const grid = $('#inv-grid'); grid.innerHTML = '';
    State.inventory.forEach(item => {
      const d = el('div','inv-item', this.iconFor(item));
      d.append(el('span','qty', item.kind === 'resource' ? String(item.qty) : 'L' + item.rolled.level));
      if (item.kind === 'component' && item.rolled.tierName) d.append(el('span','tier', item.rolled.tierName[0]));
      d.addEventListener('mouseenter', e => Tooltip.show(e, this.tooltipHtml(item)));
      d.addEventListener('mouseleave', () => Tooltip.hide());
      d.addEventListener('mousemove', e => Tooltip.move(e));
      d.addEventListener('click', () => this.showDetail(item));
      grid.append(d);
    });
    for (let i = State.inventory.length; i < Math.max(24, State.inventory.length + 8); i++) grid.append(el('div','inv-empty'));
    $('#inv-count').textContent = State.inventory.length + ' / 80 items';
  },

  tooltipHtml(item) {
    let h = '<div class="tt-title">' + esc(item.name) + '</div>';
    if (item.kind === 'resource') {
      h += '<div class="muted small">' + esc(item.resource.c.join(' › ')) + '</div>';
      h += '<div class="small">Units: ' + item.qty + '</div>';
      for (const a of RES_ATTRS) if (item.resource.a[a] !== undefined)
        h += '<div class="attr-line"><span class="an">' + attrName(a) + '</span><span class="av">' + item.resource.a[a] + '</span></div>';
    } else {
      h += '<div class="muted small">Looted component · level ' + item.rolled.level + (item.rolled.tierName ? ' · ' + item.rolled.tierName : '') + '</div>';
      for (const a in item.rolled.values) {
        const v = item.rolled.values[a];
        h += '<div class="attr-line"><span class="an">' + attrName(a) + '</span><span class="av">' + fmt(v.value, v.precision) + '</span></div>';
      }
    }
    return h;
  },

  showDetail(item) {
    Modal.open(esc(item.name), m => {
      m.innerHTML = this.tooltipHtml(item);
      const b = el('button','danger','Destroy item');
      b.style.marginTop = '10px';
      b.addEventListener('click', () => { this.remove(item.uid); Modal.close(); });
      m.append(b);
    });
  },

  openResourcePicker() {
    Modal.open('Add resource units', m => {
      m.innerHTML = '<div class="row"><input type="text" id="pick-res-q" placeholder="Search server resources..." class="grow">' +
        '<input type="number" id="pick-res-qty" value="500" min="1" style="width:90px" title="units"></div>' +
        '<div id="pick-res-list" class="scroll" style="max-height:52vh;margin-top:8px"></div>';
      const render = () => {
        const q = $('#pick-res-q').value.toLowerCase();
        const wrap = $('#pick-res-list'); wrap.innerHTML = '';
        let list = window.SWG_RESOURCES;
        if (q) list = list.filter(r => r.n.toLowerCase().includes(q) || r.c.join(' ').toLowerCase().includes(q));
        list.slice(0, 120).forEach(r => {
          const d = el('div','res-item');
          const statStr = Object.entries(r.a).map(([k,v]) => (RES_ATTR_SHORT[k]||k) + ' ' + v).join(' · ');
          d.innerHTML = '<span class="nm">' + esc(r.n) + '</span> <span class="cls">' + esc(r.c[r.c.length-1]||'') + '</span><br><span class="cls">' + statStr + '</span>';
          d.addEventListener('click', () => {
            const qty = parseInt($('#pick-res-qty').value, 10) || 500;
            Inventory.addResource(r, qty);
            toast('+' + qty + ' units ' + r.n);
          });
          wrap.append(d);
        });
      };
      $('#pick-res-q').addEventListener('input', render);
      render();
    });
  },

  openLootPicker() {
    Modal.open('Get looted crafting part', m => {
      m.innerHTML =
        '<div class="row"><input type="text" id="pick-loot-q" placeholder="Search loot items..." class="grow"></div>' +
        '<div class="row" style="margin-top:6px">' +
          '<label>Loot level <input type="number" id="pick-loot-lvl" value="300" min="1" max="350" style="width:74px"></label>' +
          '<label>Tier <select id="pick-loot-tier">' +
            '<option value="1">Experimental (normal drop)</option>' +
            '<option value="2">Enhanced</option>' +
            '<option value="8">Exceptional</option>' +
            '<option value="9">Legendary</option>' +
          '</select></label>' +
          '<span class="muted small">level 300 ≈ krayt-tier loot; server max 350</span></div>' +
        '<div id="pick-loot-list" class="scroll" style="max-height:48vh;margin-top:8px"></div>';
      const render = () => {
        const q = $('#pick-loot-q').value.toLowerCase();
        const wrap = $('#pick-loot-list'); wrap.innerHTML = '';
        let list = window.SWG_LOOT.filter(l => l.cv.length);
        if (q) list = list.filter(l => l.name.toLowerCase().includes(q) || l.id.includes(q) || l.dir.includes(q));
        list.slice(0, 120).forEach(l => {
          const d = el('div','res-item');
          d.innerHTML = '<span class="nm">' + esc(l.name) + '</span> <span class="cls">' + esc(l.dir) + '</span><br>' +
            '<span class="cls">' + l.cv.map(c => esc(c[0])).join(' · ') + '</span>';
          d.addEventListener('click', () => {
            const lvl = Math.min(350, Math.max(1, parseInt($('#pick-loot-lvl').value, 10) || 300));
            const tier = parseInt($('#pick-loot-tier').value, 10);
            const rolled = Loot.rollLoot(l, lvl, tier);
            Inventory.addLoot(l, rolled);
            toast('Looted: ' + l.name + ' (level ' + rolled.level + (rolled.tierName ? ', ' + rolled.tierName : '') + ')');
          });
          wrap.append(d);
        });
      };
      $('#pick-loot-q').addEventListener('input', render);
      render();
    });
  }
};

/* ======================================================================
   TOOLTIP + MODAL
   ====================================================================== */
const Tooltip = {
  show(e, html) { const t = $('#tooltip'); t.innerHTML = html; t.style.display = 'block'; this.move(e); },
  move(e) {
    const t = $('#tooltip');
    let x = e.clientX + 16, y = e.clientY + 12;
    const r = t.getBoundingClientRect();
    if (x + r.width > innerWidth - 8) x = e.clientX - r.width - 12;
    if (y + r.height > innerHeight - 8) y = e.clientY - r.height - 8;
    t.style.left = x + 'px'; t.style.top = y + 'px';
  },
  hide() { $('#tooltip').style.display = 'none'; }
};

const Modal = {
  open(title, build) {
    $('#modal-title').textContent = title;
    const body = $('#modal-body'); body.innerHTML = '';
    build(body);
    $('#modal-back').classList.add('open');
  },
  close() { $('#modal-back').classList.remove('open'); }
};

/* ======================================================================
   PROFESSION TABS + SCHEMATIC BROWSER
   ====================================================================== */
const ProfUI = {
  init() {
    $('#prof-search').addEventListener('input', () => this.renderList());
    this.renderList();
  },

  renderList() {
    const prof = State.currentProf;
    const { granted, extra } = schematicsForProfession(prof);
    const q = $('#prof-search').value.toLowerCase();
    const wrap = $('#schem-list'); wrap.innerHTML = '';
    const addItem = (s, isExtra) => {
      if (q && !s.name.toLowerCase().includes(q)) return;
      const d = el('div','schem-item');
      d.innerHTML = '<span>' + esc(s.name) + (isExtra ? ' <span class="muted small">(tab)</span>' : '') + '</span><span class="cx">CX ' + s.complexity + '</span>';
      if (State.currentSchematic && State.currentSchematic.id === s.id) d.classList.add('sel');
      d.addEventListener('click', () => { State.currentSchematic = s; this.renderList(); this.renderDetail(); });
      wrap.append(d);
    };
    const seen = new Set();
    granted.sort((a,b) => a.name.localeCompare(b.name)).forEach(s => { seen.add(s.id); addItem(s, false); });
    $('#schem-count').textContent = granted.length + ' schematics granted by ' + prof.label;
    this.renderDetail();
  },

  renderDetail() {
    const box = $('#schem-detail');
    const s = State.currentSchematic;
    if (!s) { box.innerHTML = '<div class="muted" style="padding:30px;text-align:center">Select a schematic from the list to view its draft details, then press <b class="gold">Start Crafting Session</b>.</div>'; return; }
    const st = crafterStats(s);
    let h = '<h2>' + esc(s.name) + '</h2>';
    h += '<div class="row" style="margin-bottom:8px">' +
      '<span class="muted">Complexity <b class="cyan">' + s.complexity + '</b></span>' +
      '<span class="muted">XP <b class="cyan">' + s.xp + '</b> (' + esc(s.xpType) + ')</span>' +
      '<span class="muted">Assembly: <b class="cyan">' + esc(s.assemblySkill) + ' = ' + st.assemblySkill + '</b></span>' +
      '<span class="muted">Experimentation: <b class="cyan">' + esc(s.expSkill) + ' = ' + st.experimentationSkill + '</b></span></div>';
    h += '<h3>Ingredient slots</h3><table class="swg"><thead><tr><th>Slot</th><th>Requires</th><th>Qty</th><th>Type</th></tr></thead><tbody>';
    for (let i = 0; i < s.slotNames.length; i++) {
      const stype = s.slotTypes[i];
      const req = s.slotRes[i] || '';
      const typeTxt = ['Resource','Identical component','Mixed components','Optional identical','Optional mixed'][stype] || stype;
      h += '<tr><td class="cyan">' + esc(slotDisplayName(s.slotStf[i], s.slotNames[i])) + '</td><td>' +
        esc(req.includes('/') ? (req.split('/').pop().replace('.iff','').replace(/_/g,' ')) : req.replace(/_/g,' ')) +
        '</td><td>' + (s.slotQty[i] || 1) + '</td><td class="muted">' + typeTxt + '</td></tr>';
    }
    h += '</tbody></table>';
    if (s.nExp) {
      const weights = buildResourceWeights(s).filter(w => !w.filler && w.attr && w.attr !== 'null');
      if (weights.length) {
        h += '<h3>Experimental properties</h3><table class="swg"><thead><tr><th>Line</th><th>Attribute</th><th>Resource weighting</th><th>Range</th></tr></thead><tbody>';
        for (const w of weights) {
          h += '<tr><td class="gold">' + esc(expGroupName(w.group)) + '</td><td>' + esc(attrName(w.attr)) + '</td><td class="cyan">' +
            w.props.filter(p => PROP_ATTR[p.code]).map(p => p.code + ' ' + Math.round(p.pct*100) + '%').join(' + ') +
            '</td><td class="muted">' + w.min + ' → ' + w.max + '</td></tr>';
        }
        h += '</tbody></table>';
      }
    }
    h += '<div style="margin-top:12px"><button class="gold" id="start-craft">Start Crafting Session</button></div>';
    box.innerHTML = h;
    $('#start-craft').addEventListener('click', () => Craft.start(s));
  }
};

/* ======================================================================
   CRAFTING SESSION (the in-game style crafting window)
   ====================================================================== */
const Craft = {
  start(sch) {
    const slots = [];
    for (let i = 0; i < sch.slotNames.length; i++) {
      slots.push({
        idx: i,
        name: slotDisplayName(sch.slotStf[i], sch.slotNames[i]),
        type: sch.slotTypes[i] || 0,
        req: sch.slotRes[i] || '',
        qty: sch.slotQty[i] || 1,
        contribution: sch.slotContrib ? (sch.slotContrib[i] !== undefined ? sch.slotContrib[i] : 100) : 100,
        filled: false, kind: null, resource: null, component: null, invUid: null
      });
    }
    State.craft = {
      sch, slots, stage: 'assembly',
      assemblyResult: null, cv: null,
      expPointsTotal: 0, expPointsLeft: 0, expLog: [], alloc: {}
    };
    $('#craft-window').classList.add('open');
    $('#craft-title-name').textContent = sch.name;
    this.render();
  },

  close() {
    $('#craft-window').classList.remove('open');
    State.craft = null;
  },

  /* ---------- slot filling ---------- */
  canFillWithResource(slot, r) {
    if (slot.req.includes('/')) return false;
    return r.ct.includes(slot.req) || r.c.map(c => c.toLowerCase().replace(/ /g, '_')).includes(slot.req);
  },
  canFillWithComponent(slot, invItem) {
    if (!slot.req.includes('/')) return false;
    const reqBase = slot.req.split('/').pop().replace('.iff', '');
    const tmpl = (invItem.loot.tmpl || '').split('/').pop().replace('.iff', '');
    if (tmpl === reqBase || tmpl === reqBase.replace('shared_','')) return true;
    // allow loose matching on component family name
    return tmpl.includes(reqBase) || reqBase.includes(tmpl);
  },

  openSlotPicker(slot) {
    Modal.open('Fill slot: ' + slot.name, m => {
      const isComp = slot.req.includes('/');
      m.innerHTML = '<div class="muted small" style="margin-bottom:6px">Requires: <b class="cyan">' +
        esc(isComp ? slot.req.split('/').pop().replace('.iff','').replace(/_/g,' ') : slot.req.replace(/_/g,' ')) +
        '</b> · quantity <b class="cyan">' + slot.qty + '</b>' + (isComp ? ' (component)' : ' (resource units)') + '</div>' +
        '<div id="slot-cand" class="scroll" style="max-height:56vh"></div>';
      const wrap = $('#slot-cand');
      let found = 0;
      for (const item of State.inventory) {
        let ok = false, warn = '';
        if (item.kind === 'resource' && !isComp) {
          ok = this.canFillWithResource(slot, item.resource);
          if (ok && item.qty < slot.qty) { warn = ' — not enough units (' + item.qty + '/' + slot.qty + ')'; }
        } else if (item.kind === 'component' && isComp) {
          ok = this.canFillWithComponent(slot, item);
          if (!ok) { ok = true; warn = ' — template mismatch, forcing fit (sim only)'; }
        }
        if (!ok) continue;
        found++;
        const d = el('div','res-item');
        d.innerHTML = '<span class="nm">' + esc(item.name) + '</span> <span class="cls">' +
          (item.kind === 'resource' ? item.qty + ' units' : 'component') + esc(warn) + '</span>';
        if (!warn || item.kind === 'component') {
          d.addEventListener('click', () => {
            if (item.kind === 'resource') {
              if (item.qty < slot.qty) { toast('Not enough units.'); return; }
              slot.filled = true; slot.kind = 'resource'; slot.resource = item.resource; slot.invUid = item.uid;
            } else {
              slot.filled = true; slot.kind = 'component'; slot.invUid = item.uid;
              slot.component = { stats: Object.entries(item.rolled.values).map(([attr, v]) => ({
                attr, value: v.value, precision: v.precision, group: '', hidden: false })) };
            }
            Modal.close(); Craft.render();
          });
        }
        wrap.append(d);
      }
      if (!found) wrap.innerHTML = '<div class="muted" style="padding:16px">Nothing suitable in inventory. Go to the <b>Inventory</b> tab to sample resources or get looted parts.' +
        (isComp ? '' : '<br><br><button id="quickfill">Quick-fill: add 10k units of best matching server resource</button>') + '</div>';
      const qf = $('#quickfill');
      if (qf) qf.addEventListener('click', () => {
        const cands = window.SWG_RESOURCES.filter(r => this.canFillWithResource(slot, r));
        if (!cands.length) { toast('No matching resource class on this server!'); return; }
        cands.sort((a, b) => (b.a.res_quality||0) - (a.a.res_quality||0));
        Inventory.addResource(cands[0], 10000);
        toast('Added 10,000 units of ' + cands[0].n);
        Modal.close(); this.openSlotPicker(slot);
      });
    });
  },

  consumeIngredients() {
    for (const slot of State.craft.slots) {
      if (!slot.filled || slot.invUid == null) continue;
      const item = State.inventory.find(i => i.uid === slot.invUid);
      if (!item) continue;
      if (slot.kind === 'resource') {
        item.qty -= slot.qty;
        if (item.qty <= 0) Inventory.remove(item.uid);
      } else Inventory.remove(item.uid);
    }
    Inventory.render();
  },

  /* ---------- assembly ---------- */
  assemble() {
    const c = State.craft;
    const required = c.slots.filter(s => s.type !== 3 && s.type !== 4);
    if (!required.every(s => s.filled)) { toast('Fill all required slots first.'); return; }
    const st = crafterStats(c.sch);
    const result = calculateAssemblySuccess(st);
    c.assemblyResult = result;
    this.consumeIngredients();
    const weights = buildResourceWeights(c.sch);
    c.cv = setInitialCraftingValues(weights, c.slots, result);
    applyComponentStats(c.cv, c.slots);
    recalculateValues(c.cv);
    c.expPointsTotal = Math.trunc(st.experimentationSkill / 10);
    c.expPointsLeft = c.expPointsTotal;
    c.stage = 'experiment';
    c.expLog.unshift({ txt: 'Assembly: ' + CraftResultText[result], cls: result <= 2 ? 'green' : result >= 6 ? 'red' : 'cyan' });
    this.render();
  },

  /* ---------- experimentation ---------- */
  expGroups() {
    const c = State.craft;
    const groups = {};
    for (const attr in c.cv) {
      const a = c.cv[attr];
      if (!a.group || a.hidden || a.maxPct <= 0) continue;
      (groups[a.group] = groups[a.group] || []).push(attr);
    }
    return groups;
  },

  experiment() {
    const c = State.craft;
    const totalAlloc = Object.values(c.alloc).reduce((s, v) => s + v, 0);
    if (!totalAlloc) { toast('Allocate experimentation points first (click the boxes).'); return; }
    const st = crafterStats(c.sch);
    for (const g in c.alloc) {
      const pts = c.alloc[g];
      if (!pts) continue;
      const result = calculateExperimentationSuccess(st);
      experimentRow(c.cv, g, pts, result);
      c.expLog.unshift({ txt: expGroupName(g) + ' (' + pts + ' pt' + (pts>1?'s':'') + '): ' + CraftResultText[result],
        cls: result <= 2 ? 'green' : result >= 6 ? 'red' : 'cyan' });
    }
    c.expPointsLeft -= totalAlloc;
    c.alloc = {};
    this.render();
  },

  finish() {
    const c = State.craft;
    c.stage = 'done';
    c.expLog.unshift({ txt: 'Prototype created: ' + c.sch.name, cls: 'gold' });
    this.render();
  },

  /* ---------- render ---------- */
  render() {
    const c = State.craft;
    if (!c) return;
    // stages
    $$('#craft-stages .stage').forEach(s => s.classList.remove('on','done'));
    const order = ['assembly','experiment','done'];
    const idx = order.indexOf(c.stage);
    $$('#craft-stages .stage').forEach((s, i) => {
      if (i < idx) s.classList.add('done');
      if (i === idx) s.classList.add('on');
    });

    const main = $('#craft-main');
    if (c.stage === 'assembly') this.renderAssembly(main);
    else this.renderExperiment(main);
    this.renderSide();
  },

  renderAssembly(main) {
    const c = State.craft;
    main.innerHTML = '<h2 class="panel-title">Ingredients — ' + esc(c.sch.name) + '</h2><div id="slot-grid"></div>' +
      '<div class="row" style="margin-top:14px"><button class="gold" id="btn-assemble">Assemble</button>' +
      '<span class="muted small">Assembly rolls use your buffed <b class="cyan">' + esc(c.sch.assemblySkill) + '</b> skill exactly like the server.</span></div>';
    const grid = $('#slot-grid');
    for (const slot of c.slots) {
      const d = el('div', 'ingr-slot' + (slot.filled ? ' filled' : '') + (slot.type >= 3 ? ' optional' : ''));
      const isComp = slot.req.includes('/');
      d.innerHTML = '<div class="socket">' + (slot.filled ? '●' : (isComp ? '⬡' : '◍')) + '</div>' +
        '<div class="sn">' + esc(slot.name) + (slot.type >= 3 ? ' <span class="muted">(optional)</span>' : '') + '</div>' +
        '<div class="sq">' + (isComp ? 'component ×' : '') + slot.qty + (isComp ? '' : ' units') + '</div>' +
        (slot.filled ? '<div class="sfill">' + esc(slot.kind === 'resource' ? slot.resource.n : 'Component fitted') + '</div>' : '');
      d.addEventListener('click', () => {
        if (slot.filled) { slot.filled = false; slot.resource = null; slot.component = null; slot.invUid = null; Craft.render(); }
        else this.openSlotPicker(slot);
      });
      grid.append(d);
    }
    $('#btn-assemble').addEventListener('click', () => this.assemble());
  },

  renderExperiment(main) {
    const c = State.craft;
    const groups = this.expGroups();
    let h = '<h2 class="panel-title">Experimentation — ' + esc(c.sch.name) + '</h2>' +
      '<div class="row" style="margin-bottom:8px"><span>Points remaining: <b class="gold" style="font-size:14px">' + c.expPointsLeft + '</b> / ' + c.expPointsTotal + '</span></div>';
    main.innerHTML = h;
    const totalAlloc = () => Object.values(c.alloc).reduce((s, v) => s + v, 0);

    for (const g in groups) {
      const attrs = groups[g];
      const a0 = c.cv[attrs[0]];
      const row = el('div','exp-row');
      const pct = a0.pct, maxPct = a0.maxPct;
      const alloc = c.alloc[g] || 0;
      let ptsHtml = '';
      for (let i = 1; i <= 10; i++) ptsHtml += '<span class="exp-pt' + (i <= alloc ? ' on' : '') + '" data-g="' + esc(g) + '" data-n="' + i + '"></span>';
      row.innerHTML =
        '<div class="top"><span class="nm">' + esc(expGroupName(g)) + '</span>' +
        '<span class="pctbar"><span class="pfill" style="width:' + Math.min(100, pct * 100) + '%"></span>' +
        '<span class="pmax" style="left:' + Math.min(100, maxPct * 100) + '%"></span></span>' +
        '<span class="pctxt">' + (pct * 100).toFixed(1) + '% / ' + (maxPct * 100).toFixed(1) + '%</span></div>' +
        '<div class="attrs">' + attrs.map(a => esc(attrName(a)) + ': <b>' + fmt(c.cv[a].value, c.cv[a].precision) + '</b>').join(' · ') + '</div>' +
        (c.stage === 'experiment' ? '<div class="pts" style="margin-top:5px"><span class="muted small" style="margin-right:4px">points:</span>' + ptsHtml + '</div>' : '');
      main.append(row);
    }
    if (!Object.keys(groups).length) main.append(el('div','muted','No experimentable properties on this schematic.'));

    if (c.stage === 'experiment') {
      const bar = el('div','row'); bar.style.marginTop = '12px';
      const bx = el('button','gold','Experiment'); bx.addEventListener('click', () => this.experiment());
      const bf = el('button','','Create Prototype'); bf.addEventListener('click', () => this.finish());
      bar.append(bx, bf);
      if (c.expPointsLeft <= 0) bx.disabled = true;
      main.append(bar);
      main.querySelectorAll('.exp-pt').forEach(pt => {
        pt.addEventListener('click', () => {
          const g = pt.dataset.g, n = parseInt(pt.dataset.n, 10);
          const cur = c.alloc[g] || 0;
          const others = totalAlloc() - cur;
          let want = (n === cur) ? 0 : n;
          if (others + want > c.expPointsLeft) want = Math.max(0, c.expPointsLeft - others);
          c.alloc[g] = want;
          this.render();
        });
      });
    } else if (c.stage === 'done') {
      const fin = el('div','swg-panel'); fin.style.marginTop = '12px';
      let fh = '<h2>Prototype complete</h2>';
      for (const attr in c.cv) {
        const a = c.cv[attr];
        if (a.hidden) continue;
        fh += '<div class="attr-line"><span class="an">' + esc(attrName(attr)) + '</span><span class="av">' + fmt(a.value, a.precision) + '</span></div>';
      }
      fh += '<div class="row" style="margin-top:10px"><button class="gold" id="btn-again">Craft another</button></div>';
      fin.innerHTML = fh;
      main.append(fin);
      $('#btn-again').addEventListener('click', () => Craft.start(c.sch));
    }
  },

  renderSide() {
    const c = State.craft;
    const side = $('#craft-side');
    const st = crafterStats(c.sch);
    let h = '<h2 class="panel-title">Crafter loadout</h2>';
    h += '<div class="attr-line"><span class="an">' + esc(st.aSkillName) + '</span><span class="av">' + st.assemblySkill + '</span></div>';
    h += '<div class="attr-line"><span class="an">' + esc(st.eSkillName) + '</span><span class="av">' + st.experimentationSkill + '</span></div>';
    h += '<div class="attr-line"><span class="an">Tool effectiveness</span><span class="av">+' + st.toolEffectiveness + '</span></div>';
    h += '<div class="attr-line"><span class="an">Pyollian Cake (assembly)</span><span class="av">' + (st.foodCraftBonus ? '+' + st.foodCraftBonus : 'off') + '</span></div>';
    h += '<div class="attr-line"><span class="an">Bespin Port (experiment)</span><span class="av">' + (st.foodExperimentBonus ? '+' + st.foodExperimentBonus : 'off') + '</span></div>';
    h += '<div class="small muted" style="margin-top:4px">Change these on the Buffs tab.</div>';

    if (c.cv) {
      h += '<h2 class="panel-title" style="margin-top:12px">Attributes</h2>';
      for (const attr in c.cv) {
        const a = c.cv[attr];
        if (a.hidden) continue;
        h += '<div class="attr-line"><span class="an">' + esc(attrName(attr)) + '</span><span class="av">' + fmt(a.value, a.precision) + '</span></div>';
      }
    }
    h += '<h2 class="panel-title" style="margin-top:12px">Session log</h2><div id="craft-log">';
    for (const l of State.craft.expLog.slice(0, 14)) h += '<div class="' + l.cls + ' small">&gt; ' + esc(l.txt) + '</div>';
    h += '</div>';
    side.innerHTML = h;
  }
};

/* ======================================================================
   BUFFS TAB
   ====================================================================== */
const BuffsUI = {
  init() { this.render(); },
  render() {
    const box = $('#buffs-body');
    const prof = State.currentProf;
    const mods = maxedSkillMods(prof);
    let h = '<h2 class="panel-title">Crafter buffs & skill loadout (maxed by default)</h2>';
    h += '<div class="row" style="margin-bottom:10px">';
    h += '<span class="buff-chip' + (State.buffs.attachments ? ' on' : '') + '" data-b="attachments">Clothing/Armor attachments (SEA) +25 assembly & experimentation — server wearable cap</span>';
    h += '<span class="buff-chip' + (State.buffs.pyollianCake ? ' on' : '') + '" data-b="pyollianCake">Pyollian Cake +10 craft bonus (max crafted)</span>';
    h += '<span class="buff-chip' + (State.buffs.bespinPort ? ' on' : '') + '" data-b="bespinPort">Bespin Port +12 experiment bonus (max crafted)</span>';
    h += '</div>';
    h += '<div class="row" style="margin-bottom:10px">' +
      '<label>Crafting tool effectiveness <input type="number" id="buff-tool" value="' + State.buffs.tool + '" min="-15" max="15" style="width:64px"> (max crafted +15)</label>' +
      '<label>Luck skill mod <input type="number" id="buff-luck" value="' + State.buffs.luck + '" min="0" max="200" style="width:64px"></label></div>';
    h += '<div class="small muted" style="max-width:760px">Entertainer buffs (Inspiration) increase crafting <b>XP</b> earned by up to 10% on this server, but do not change assembly or experimentation rolls — the formulas in CraftingManagerImplementation.cpp only use skill mods, tool effectiveness, the two foods above, and luck. That is why there is no entertainer toggle here.</div>';
    h += '<h2 class="panel-title" style="margin-top:14px">' + esc(prof.label) + ' — skill mods at master (sum of all boxes)</h2>';
    h += '<table class="swg"><thead><tr><th>Skill mod</th><th>Value</th></tr></thead><tbody>';
    Object.keys(mods).sort().forEach(m => {
      if (!/assembly|experimentation|repair|customization|surveying/.test(m)) return;
      h += '<tr><td>' + esc(m) + '</td><td class="cyan">' + mods[m] + '</td></tr>';
    });
    h += '</tbody></table>';
    h += '<div class="row" style="margin-top:10px">' +
      '<label>Override assembly skill <input type="number" id="buff-asm" placeholder="auto" style="width:74px" value="' + (State.buffs.manualAssembly ?? '') + '"></label>' +
      '<label>Override experimentation skill <input type="number" id="buff-exp" placeholder="auto" style="width:74px" value="' + (State.buffs.manualExperimentation ?? '') + '"></label>' +
      '<span class="muted small">leave blank to auto-compute from the profession + attachments</span></div>';
    box.innerHTML = h;
    box.querySelectorAll('.buff-chip').forEach(ch => ch.addEventListener('click', () => {
      State.buffs[ch.dataset.b] = !State.buffs[ch.dataset.b];
      this.render();
    }));
    $('#buff-tool').addEventListener('change', e => State.buffs.tool = Math.max(-15, Math.min(15, parseInt(e.target.value, 10) || 0)));
    $('#buff-luck').addEventListener('change', e => State.buffs.luck = Math.max(0, parseInt(e.target.value, 10) || 0));
    $('#buff-asm').addEventListener('change', e => State.buffs.manualAssembly = e.target.value === '' ? null : parseInt(e.target.value, 10));
    $('#buff-exp').addEventListener('change', e => State.buffs.manualExperimentation = e.target.value === '' ? null : parseInt(e.target.value, 10));
  }
};

/* ======================================================================
   TABS + BOOT
   ====================================================================== */
function switchTab(id) {
  $$('.mtab').forEach(t => t.classList.toggle('active', t.dataset.tab === id));
  $$('.tabpane').forEach(p => p.classList.toggle('active', p.id === 'tab-' + id));
  if (id.startsWith('prof-')) {
    const prof = PROFESSIONS.find(p => 'prof-' + p.id === id);
    if (prof) { State.currentProf = prof; State.currentSchematic = null; ProfUI.renderList(); }
    // profession panes share one pane
    $$('.tabpane').forEach(p => p.classList.toggle('active', p.id === 'tab-professions'));
  }
  if (id === 'buffs') BuffsUI.render();
}

function boot() {
  // build main tabs
  const tabs = $('#main-tabs');
  const mk = (id, label) => {
    const t = el('div','mtab', esc(label)); t.dataset.tab = id;
    t.addEventListener('click', () => switchTab(id));
    tabs.append(t);
    return t;
  };
  mk('map', '🌍 Resource Map');
  mk('resources', '📊 Resources');
  PROFESSIONS.forEach(p => mk('prof-' + p.id, p.label));
  mk('inventory', '🎒 Inventory');
  mk('buffs', '✨ Buffs');
  mk('help', '❓ Help');

  const total = window.SWG_RESOURCES.length;
  $('#server-status').innerHTML = 'Hooked to <b>C:\\Companion</b> — <b>' + total + '</b> resources · <b>' +
    window.SWG_SCHEMATICS.length + '</b> schematics · <b>' + window.SWG_LOOT.length + '</b> loot items';

  MapUI.init();
  ResourceDB.init();
  ProfUI.init();
  Inventory.init();
  BuffsUI.init();

  $('#craft-close').addEventListener('click', () => Craft.close());
  $('#modal-close').addEventListener('click', () => Modal.close());
  $('#modal-back').addEventListener('click', e => { if (e.target.id === 'modal-back') Modal.close(); });

  switchTab('map');
}
document.addEventListener('DOMContentLoaded', boot);
