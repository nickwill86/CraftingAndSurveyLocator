/* =========================================================================
   NickWIll86's Just For Fun Crafting Simulator — game engine math
   All formulas ported 1:1 from the Core3 server source in C:\Companion
   ========================================================================= */
'use strict';

/* ---------------- RNG (matches engine System::random semantics) -------- */
const RNG = {
  // System::random(n): uniform integer 0..n inclusive
  int(n) { return Math.floor(Math.random() * (n + 1)); },
  // System::frandom(n): uniform float 0..n
  float(n) { return Math.random() * (n === undefined ? 1 : n); }
};

/* ---------------- SimplexNoise (exact port of Core3 SimplexNoise.cpp) -- */
const SimplexNoise = (() => {
  const perm = new Uint8Array([151,160,137,91,90,15,
    131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,
    190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,
    88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,
    77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,
    102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,
    135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,
    5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,
    223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,
    129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,
    251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,
    49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,
    138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180,
    151,160,137,91,90,15,
    131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,
    190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,
    88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,
    77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,
    102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,
    135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,
    5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,
    223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,
    129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,
    251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,
    49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,
    138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180]);

  const F3 = 0.333333333, G3 = 0.166666667;
  // FASTFLOOR(x) = ((x)>0) ? ((int)x) : ((int)x - 1)  -- C truncation
  const fastfloor = x => x > 0 ? Math.trunc(x) : Math.trunc(x) - 1;

  function grad3(hash, x, y, z) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
  }

  function noise3(x, y, z) {
    let n0, n1, n2, n3;
    const s = (x + y + z) * F3;
    const i = fastfloor(x + s), j = fastfloor(y + s), k = fastfloor(z + s);
    const t = (i + j + k) * G3;
    const X0 = i - t, Y0 = j - t, Z0 = k - t;
    const x0 = x - X0, y0 = y - Y0, z0 = z - Z0;

    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0)      { i1=1;j1=0;k1=0;i2=1;j2=1;k2=0; }
      else if (x0 >= z0) { i1=1;j1=0;k1=0;i2=1;j2=0;k2=1; }
      else               { i1=0;j1=0;k1=1;i2=1;j2=0;k2=1; }
    } else {
      if (y0 < z0)       { i1=0;j1=0;k1=1;i2=0;j2=1;k2=1; }
      else if (x0 < z0)  { i1=0;j1=1;k1=0;i2=0;j2=1;k2=1; }
      else               { i1=0;j1=1;k1=0;i2=1;j2=1;k2=0; }
    }

    const x1 = x0 - i1 + G3,   y1 = y0 - j1 + G3,   z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2*G3, y2 = y0 - j2 + 2*G3, z2 = z0 - k2 + 2*G3;
    const x3 = x0 - 1 + 3*G3,  y3 = y0 - 1 + 3*G3,  z3 = z0 - 1 + 3*G3;

    const ii = ((i % 256) + 256) % 256, jj = ((j % 256) + 256) % 256, kk = ((k % 256) + 256) % 256;

    let t0 = 0.6 - x0*x0 - y0*y0 - z0*z0;
    if (t0 < 0) n0 = 0; else { t0 *= t0; n0 = t0 * t0 * grad3(perm[ii+perm[jj+perm[kk]]], x0, y0, z0); }
    let t1 = 0.6 - x1*x1 - y1*y1 - z1*z1;
    if (t1 < 0) n1 = 0; else { t1 *= t1; n1 = t1 * t1 * grad3(perm[ii+i1+perm[jj+j1+perm[kk+k1]]], x1, y1, z1); }
    let t2 = 0.6 - x2*x2 - y2*y2 - z2*z2;
    if (t2 < 0) n2 = 0; else { t2 *= t2; n2 = t2 * t2 * grad3(perm[ii+i2+perm[jj+j2+perm[kk+k2]]], x2, y2, z2); }
    let t3 = 0.6 - x3*x3 - y3*y3 - z3*z3;
    if (t3 < 0) n3 = 0; else { t3 *= t3; n3 = t3 * t3 * grad3(perm[ii+1+perm[jj+1+perm[kk+1]]], x3, y3, z3); }

    return 32.0 * (n0 + n1 + n2 + n3);
  }
  return { noise3 };
})();

/* ---------------- SpawnDensityMap (exact port of SpawnDensityMap.h) ---- */
/* Zone bounds for all standard ground planets: -8192 .. 8192               */
const ZONE_MIN = -8192, ZONE_MAX = 8192;

class SpawnDensityMap {
  constructor(seed, isOre, density) {
    this.seed = seed >>> 0;
    this.modifier = isOre ? 0.00015 : 0.0006;
    this.density = density;
    this.minX = ZONE_MIN; this.maxX = ZONE_MAX;
    this.minY = ZONE_MIN; this.maxY = ZONE_MAX;
  }
  // exact copy of SpawnDensityMap::getDensityAt
  getDensityAt(x, y) {
    x -= this.minX;
    y = this.maxY - y;
    const v = SimplexNoise.noise3(x * this.modifier, y * this.modifier, this.seed * this.modifier);
    if (v < 0) return 0;
    return v * this.density;
  }
  // SpawnDensityMap::initialize density roll
  static rollDensity(concClass) {
    switch (concClass) {
      case 1: return (RNG.int(9) + 90) / 100;   // HIGHDENSITY  0.90-0.99
      case 2: return (RNG.int(20) + 75) / 100;  // MEDIUMDENSITY 0.75-0.95
      case 3: return (RNG.int(25) + 50) / 100;  // LOWDENSITY   0.50-0.75
      default: return (RNG.int(25) + 50) / 100;
    }
  }
}

// ResourceSpawn::isType — checks the class type chain
function hasType(classTypes, type) { return classTypes.some(c => c === type); }
function isOreResource(classTypes) { return hasType(classTypes, 'ore'); }

// ResourceSpawnImplementation::getConcentration
function concentrationClass(classTypes, jtl) {
  if (jtl || hasType(classTypes, 'chemical') || hasType(classTypes, 'gas_inert')) return 1;
  if (hasType(classTypes, 'ore') || hasType(classTypes, 'water') ||
      hasType(classTypes, 'energy_renewable_unlimited_solar') ||
      hasType(classTypes, 'energy_renewable_unlimited_wind')) return 3;
  return 2;
}

/* ---------------- Hand sampling (ResourceSpawner::sendSampleResults) --- */
function handSample(density, surveySkill, opts = {}) {
  const out = { success: false, units: 0, messages: [] };
  if (density < 0.10) {
    out.messages.push('Density too low to obtain a sample (below 10%).');
    return out;
  }
  if ((density * 100) < (32 - (Math.trunc(surveySkill / 20) * 6))) {
    out.messages.push('Concentration below your skill threshold.');
    return out;
  }
  const sampleRate = (surveySkill * density) + RNG.int(100) + (opts.specSampleRate || 0);
  const gamble = !!opts.gamble, node = !!opts.richNode;
  if (!gamble && !node && sampleRate < 40) {
    out.messages.push('Sample failed (roll ' + Math.round(sampleRate) + ' < 40).');
    return out;
  }
  const maxUnits = Math.trunc(density * (25 + RNG.int(3)));
  const cityMult = 1 + (opts.specSampleSize || 0) / 100;
  let units = Math.trunc(maxUnits * (surveySkill / 100) * (opts.samplingMultiplier || 1) * cityMult);
  if (gamble) {
    if (RNG.int(2) === 1) { units *= 5; out.messages.push('Gamble success! x5 units.'); }
    else out.messages.push('Gamble failed.');
  }
  if (node) { units *= 5; out.messages.push('Rich concentration node recovered! x5 units.'); }
  if (units < 2) {
    out.messages.push('Only trace amounts found (' + units + ' units).');
    return out;
  }
  out.success = true; out.units = units;
  out.messages.push('Sample located: ' + units + ' units.');
  return out;
}

/* ---------------- Crafting result enums (CraftingManager) -------------- */
const CraftResult = {
  AMAZINGSUCCESS: 0, GREATSUCCESS: 1, GOODSUCCESS: 2, MODERATESUCCESS: 3,
  SUCCESS: 4, MARGINALSUCCESS: 5, OK: 6, BARELYSUCCESSFUL: 7, CRITICALFAILURE: 8
};
const CraftResultText = [
  'Amazing success!', 'Great success!', 'Good success', 'Moderate success',
  'Success', 'Marginal success', 'OK', 'Barely successful', 'Critical failure!'
];

/* Resource property codes (ResourceWeight::convertStringValue) */
const PROP_ATTR = {
  CR: 'res_cold_resist', CD: 'res_conductivity', DR: 'res_decay_resist',
  HR: 'res_heat_resist', FL: 'res_flavor', MA: 'res_malleability',
  PE: 'res_potential_energy', OQ: 'res_quality', SR: 'res_shock_resistance',
  UT: 'res_toughness', BK: 'res_bulk'
};

/* ---------------- Assembly (SharedLabratory::calculateAssemblySuccess) - */
function calculateAssemblySuccess(st) {
  const cityBonus = st.cityAssembly || 0;
  const assemblySkill = st.assemblySkill + (st.forceAssembly || 0);
  const assemblyPoints = assemblySkill / 10.0;
  let failMitigate = Math.trunc((st.assemblySkill - 100 + cityBonus) / 7);
  failMitigate += (st.forceFailReduction || 0);
  if (failMitigate < 0) failMitigate = 0;
  if (failMitigate > 5) failMitigate = 5;

  let toolModifier = 1.0 + (st.toolEffectiveness || 0) / 100.0;
  const craftbonus = st.foodCraftBonus || 0;               // Pyollian Cake
  if (craftbonus) toolModifier *= 1.0 + (craftbonus / 100.0);

  let luckRoll = RNG.int(100) + cityBonus;
  if (luckRoll > (95 - craftbonus)) return CraftResult.AMAZINGSUCCESS;
  if (luckRoll < (5 - craftbonus - failMitigate)) luckRoll -= RNG.int(100);
  luckRoll += RNG.int((st.luck || 0) + (st.forceLuck || 0));

  const assemblyRoll = Math.trunc(toolModifier * (luckRoll + assemblyPoints * 5));
  if (assemblyRoll > 70) return CraftResult.GREATSUCCESS;
  if (assemblyRoll > 60) return CraftResult.GOODSUCCESS;
  if (assemblyRoll > 50) return CraftResult.MODERATESUCCESS;
  if (assemblyRoll > 40) return CraftResult.SUCCESS;
  if (assemblyRoll > 30) return CraftResult.MARGINALSUCCESS;
  if (assemblyRoll > 20) return CraftResult.OK;
  return CraftResult.BARELYSUCCESSFUL;
}

/* -------- Experimentation (CraftingManager::calculateExperimentationSuccess) */
function calculateExperimentationSuccess(st) {
  const cityBonus = st.cityExperimentation || 0;
  const forceSkill = st.forceExperimentation || 0;
  const experimentationSkill = st.experimentationSkill + forceSkill;
  const experimentingPoints = experimentationSkill / 10.0;

  let failMitigate = Math.trunc((st.assemblySkill - 100 + cityBonus) / 7);
  failMitigate += (st.forceFailReduction || 0);
  if (failMitigate < 0) failMitigate = 0;
  if (failMitigate > 5) failMitigate = 5;

  let toolModifier = 1.0 + (st.toolEffectiveness || 0) / 100.0;
  const expbonus = st.foodExperimentBonus || 0;            // Bespin Port
  if (expbonus) toolModifier *= 1.0 + (expbonus / 100.0);

  let luckRoll = RNG.int(100) + cityBonus;
  if (luckRoll > ((95 - expbonus) - forceSkill)) return CraftResult.AMAZINGSUCCESS;
  if (luckRoll < (5 - expbonus - failMitigate)) luckRoll -= RNG.int(100);
  luckRoll += RNG.int((st.luck || 0) + (st.forceLuck || 0));

  const experimentRoll = Math.trunc(toolModifier * (luckRoll + experimentingPoints * 4));
  if (experimentRoll > 70) return CraftResult.GREATSUCCESS;
  if (experimentRoll > 60) return CraftResult.GOODSUCCESS;
  if (experimentRoll > 50) return CraftResult.MODERATESUCCESS;
  if (experimentRoll > 40) return CraftResult.SUCCESS;
  if (experimentRoll > 30) return CraftResult.MARGINALSUCCESS;
  if (experimentRoll > 20) return CraftResult.OK;
  return CraftResult.BARELYSUCCESSFUL;
}

/* SharedLabratory helpers */
function calculateAssemblyValueModifier(assemblyResult) {
  if (assemblyResult === CraftResult.AMAZINGSUCCESS) return 1.05;
  return 1.1 - assemblyResult * 0.1;
}
function calculateExperimentationValueModifier(expResult, pointsAttempted) {
  let r;
  switch (expResult) {
    case CraftResult.AMAZINGSUCCESS:   r = 0.08; break;
    case CraftResult.GREATSUCCESS:     r = 0.07; break;
    case CraftResult.GOODSUCCESS:      r = 0.055; break;
    case CraftResult.MODERATESUCCESS:  r = 0.015; break;
    case CraftResult.SUCCESS:          r = 0.01; break;
    case CraftResult.MARGINALSUCCESS:  r = 0.00; break;
    case CraftResult.OK:               r = -0.04; break;
    case CraftResult.BARELYSUCCESSFUL: r = -0.07; break;
    case CraftResult.CRITICALFAILURE:  r = -0.08; break;
    default: r = 0;
  }
  return r * pointsAttempted;
}
function getAssemblyPercentage(value) {
  return (value * (0.000015 * value + 0.015)) * 0.01;
}

/* -------- getWeightedValue (SharedLabratory::getWeightedValue) ---------- */
function getWeightedValue(slots, attr) {
  let nsum = 0, weighted = 0;
  for (const s of slots) {
    if (!s || !s.filled) continue;
    let stat = 0;
    if (s.kind === 'resource') stat = s.resource.a[attr] || 0;
    else continue;
    if (stat !== 0) { nsum += s.qty; weighted += stat * s.qty; }
  }
  if (weighted !== 0) weighted /= nsum;
  return weighted;
}

/* -------- Combine types (AttributesMap) -------------------------------- */
const Combine = { LINEAR: 1, PERCENTAGE: 2, BITSET: 3, OVERRIDE: 4, LIMITED: 5 };

/* -------- Build experimental attribute rows from schematic data -------- */
function buildResourceWeights(sch) {
  const out = [];
  const nExp = sch.nExp || [];
  const props = sch.expProp || [];
  const weights = sch.expWeight || [];
  const groups = sch.expGroup || [];
  const subs = sch.expSub || [];
  const mins = sch.expMin || [];
  const maxs = sch.expMax || [];
  const precs = sch.expPrec || [];
  const combines = sch.expCombine || [];
  let w = 0;
  for (let i = 0; i < nExp.length; i++) {
    const entry = {
      attr: subs[i], group: groups[i],
      min: mins[i], max: maxs[i],
      precision: precs[i] || 0, combine: combines[i] || 0,
      props: [], filler: true
    };
    let denom = 0;
    const list = [];
    for (let j = 0; j < nExp[i]; j++, w++) {
      const code = props[w];
      const wt = (PROP_ATTR[code] ? (weights[w] % 16) : 0);
      if (PROP_ATTR[code]) entry.filler = false;
      list.push({ code, weight: wt });
      denom += wt;
    }
    for (const p of list) p.pct = denom ? p.weight / denom : 0;
    entry.props = list;
    out.push(entry);
  }
  return out;
}

/* -------- setInitialCraftingValues (ResourceLabratory) ------------------ */
function setInitialCraftingValues(weightsList, slots, assemblyResult) {
  const cv = {};
  const modifier = calculateAssemblyValueModifier(assemblyResult);
  for (const rw of weightsList) {
    const attr = rw.attr, group = rw.group;
    if (!attr || attr === 'null') continue;
    let weightedSum = 0;
    for (const p of rw.props) {
      const a = PROP_ATTR[p.code];
      if (!a) continue;
      weightedSum += getWeightedValue(slots, a) * p.pct;
    }
    cv[attr] = {
      group: (group && group !== 'null') ? group : '',
      min: rw.min, max: rw.max,
      precision: rw.precision, combine: rw.combine,
      pct: 0, maxPct: 0, value: 0,
      hidden: rw.filler, weightedSum
    };
    if (weightedSum > 0) {
      cv[attr].maxPct = (weightedSum / 10.0) * 0.01;
      cv[attr].pct = getAssemblyPercentage(weightedSum) * modifier;
      if (cv[attr].pct > cv[attr].maxPct) cv[attr].pct = cv[attr].maxPct;
    }
  }
  recalculateValues(cv);
  return cv;
}

/* -------- CraftingValues::recalculateValues ---------------------------- */
function recalculateValues(cv) {
  for (const attr in cv) {
    const a = cv[attr];
    const { min, max, pct } = a;
    let v;
    if (a.group === '') v = (max > min) ? max : min;
    else if (max !== min) {
      if (max > min) v = pct * (max - min) + min;
      else v = (1 - pct) * (min - max) + max;
    } else v = max;
    a.value = v;
  }
}

/* -------- applyComponentStats (ResourceLabratory) ----------------------- */
function applyComponentStats(cv, slots) {
  for (const s of slots) {
    if (!s || !s.filled || s.kind !== 'component') continue;
    const comp = s.component;
    const contribution = (s.contribution !== undefined ? s.contribution : 100) / 100;
    for (const st of comp.stats) {
      const attr = st.attr;
      if (!attr || attr === 'null') continue;
      if (cv[attr]) {
        const a = cv[attr];
        const propertyvalue = st.value * contribution;
        switch (a.combine) {
          case Combine.LINEAR:
            a.value += propertyvalue; a.min += propertyvalue; a.max += propertyvalue;
            break;
          case Combine.PERCENTAGE:
            a.min += propertyvalue; a.max += propertyvalue;
            a.pct = Math.min(1, a.pct + propertyvalue);
            break;
          case Combine.BITSET:
            a.value = (a.value | 0) | (propertyvalue | 0);
            break;
          case Combine.OVERRIDE:
            break;
          case Combine.LIMITED: {
            let nv = a.value + propertyvalue;
            if (nv < a.min) nv = a.min;
            if (nv > a.max) nv = a.max;
            a.value = nv;
            break;
          }
        }
      } else {
        cv[attr] = {
          group: st.group || '', min: st.value, max: st.value,
          precision: st.precision || 0, combine: Combine.LINEAR,
          pct: 0, maxPct: 0, value: st.value, hidden: !!st.hidden, weightedSum: 0
        };
      }
    }
  }
}

/* -------- experimentRow (ResourceLabratory::experimentRow) -------------- */
function experimentRow(cv, groupName, pointsAttempted, expResult) {
  const modifier = calculateExperimentationValueModifier(expResult, pointsAttempted);
  for (const attr in cv) {
    const a = cv[attr];
    if (a.group !== groupName) continue;
    let nv = a.pct + modifier;
    if (nv > a.maxPct) nv = a.maxPct;
    if (nv < 0) nv = 0;
    a.pct = nv;
  }
  recalculateValues(cv);
  return modifier;
}

/* ========================================================================
   LOOT VALUES — exact port of LootValues.cpp
   ======================================================================== */
const Loot = (() => {
  const EPSILON = 5e-7, DISTMAX = 0.95, DISTMIN = 0.15;
  const LEVELMAX = 350, LEVELMIN = 0, DISTNORMAL = 2.82333;
  const RandomType = { STATIC: 0, UNIFORM: 1, DYNAMIC: 2, NORMAL: 3 };
  const BonusType = { LEGENDARY: 9, EXCEPTIONAL: 8, ENHANCED: 2, EXPERIMENTAL: 1, STATIC: 0 };

  const clamp = (lo, v, hi) => Math.min(Math.max(v, lo), hi);
  const lerp = (a, b, t) => a + (b - a) * t;

  function getLevelRankValue(level, distMin = 0, distMax = 1) {
    const rank = clamp(0, (level - LEVELMIN) / (LEVELMAX - LEVELMIN), 1);
    return lerp(distMin, distMax, rank);
  }
  function getPercentageValueF(min, max, percentage) {
    if (Math.abs(max - min) < EPSILON) return min;
    return (max - min) * clamp(0, percentage, 1) + min;
  }
  function getValuePercentage(min, max, value) {
    if (Math.abs(max - min) < EPSILON) return 0;
    let p = max > min ? (value - min) / (max - min) : (min - value) / (min - max);
    return clamp(0, p, 1);
  }
  function getRandomValueF(min, max) {
    if (Math.abs(max - min) < EPSILON) return min;
    const lo = Math.min(min, max), hi = Math.max(min, max);
    return clamp(lo, RNG.float(hi - lo) + lo, hi);
  }
  function getRandomValueI(min, max) {
    if (max === min) return min;
    const lo = Math.min(min, max), hi = Math.max(min, max);
    return clamp(lo, RNG.int(hi - lo) + lo, hi);
  }
  function getNormalValueF(min, max) {
    if (Math.abs(max - min) < EPSILON) return min;
    const r1 = RNG.float(1);
    const r2 = RNG.float(1 - 1e-7) + 1e-7;
    const theta = Math.cos(2 * Math.PI * r1);
    const radius = Math.sqrt(-2 * Math.log(r2));
    const dist = (((theta * radius * 0.5) / DISTNORMAL) + 1) * 0.5;
    const lo = Math.min(min, max), hi = Math.max(min, max);
    return clamp(lo, (hi - lo) * dist + lo, hi);
  }
  function getDistributedValueF(min, max, level, distMin = 0, distMax = 1) {
    if (Math.abs(max - min) < EPSILON) return min;
    const rank = clamp(-1, getLevelRankValue(level, distMin, distMax), 2);
    const inverted = max < min;
    const vMin = min, vMax = max;
    if (inverted) { min = vMax; max = vMin; }
    let mid = (max - min) * rank + min;
    if (mid < min) { max += (mid - min); mid = min; }
    if (mid > max) { min += (mid - max); mid = max; }
    const rMin = getRandomValueF(min, mid);
    const rMax = getRandomValueF(mid, max);
    let rv = getRandomValueF(rMin, rMax);
    if (inverted) rv = (vMax - rv) + vMin;
    return clamp(min, rv, max);
  }
  function getModifierValue(min, max, percentageMax) {
    if (Math.abs(max - min) < EPSILON || percentageMax <= 1) {
      return getPercentageValueF(min, max, percentageMax);
    }
    const inverted = min >= max;
    const positive = max >= 0;
    const signBit = positive ? 1 : -1;
    const value = Math.min(Math.abs(min), Math.abs(max)) * signBit;
    if (inverted !== positive) return value * (percentageMax - 1) + max;
    return value / percentageMax;
  }

  const DYNAMIC_ATTRS = new Set([
    'armor_effectiveness','armor_integrity','armor_health_encumbrance','armor_action_encumbrance',
    'armor_mind_encumbrance','armor_special_effectiveness','kineticeffectiveness','energyeffectiveness',
    'electricaleffectiveness','stuneffectiveness','blasteffectiveness','heateffectiveness',
    'coldeffectiveness','acideffectiveness','restraineffectiveness','power','charges','area','range',
    'potency','duration','hitpoints','mindamage','maxdamage','attackspeed','woundchance',
    'zerorangemod','maxrangemod','midrangemod','attackhealthcost','attackactioncost','attackmindcost'
  ]);

  function attrRandomType(attr) {
    const a = attr.toLowerCase();
    if (a === 'usecount') return RandomType.UNIFORM;
    if (DYNAMIC_ATTRS.has(a) || a.startsWith('ship_component_')) return RandomType.DYNAMIC;
    return RandomType.STATIC;
  }

  function rollLoot(item, lootLevel, modifier) {
    // LootValues::setLevel
    let levelMax = item.lmax, levelMin = item.lmin;
    let level = 0;
    if (!(levelMax === 0 && levelMin === 0)) {
      if (levelMax > LEVELMAX || levelMax === -1) levelMax = LEVELMAX;
      if (levelMin < LEVELMIN) levelMin = LEVELMIN;
      const levelRank = getLevelRankValue(lootLevel);
      level = levelMax === levelMin ? levelMin : Math.round(getPercentageValueF(levelMin, levelMax, levelRank));
      if (levelMin >= 1 && modifier === BonusType.STATIC) modifier = BonusType.EXPERIMENTAL;
    }
    modifier = clamp(BonusType.STATIC, modifier, BonusType.LEGENDARY + 1);

    const dynamicIdx = [];
    const values = {};

    for (const row of item.cv) {
      const [attr, min, max, prec] = row;
      let rt = attrRandomType(attr);
      if (min === max && max === 0) rt = RandomType.STATIC;
      const precision = prec % 10;
      const rec = { attr, min, max, precision, randomType: rt, value: min, pct: 0 };
      values[attr] = rec;
      if (rt === RandomType.STATIC || min === max) { rec.value = min; continue; }
      if (rt === RandomType.DYNAMIC) { dynamicIdx.push(attr); continue; }
      if (rt === RandomType.UNIFORM) {
        rec.value = precision === 0 ? getRandomValueI(Math.round(min), Math.round(max)) : getRandomValueF(min, max);
        rec.pct = getValuePercentage(min, max, rec.value);
        continue;
      }
      if (rt === RandomType.NORMAL) {
        rec.value = precision === 0 ? Math.round(getNormalValueF(min, max)) : getNormalValueF(min, max);
        rec.pct = getValuePercentage(min, max, rec.value);
        continue;
      }
    }

    if (modifier > 0 && level > 0 && dynamicIdx.length > 0) {
      let dynamicValues = dynamicIdx.length;
      if (modifier <= BonusType.ENHANCED) {
        dynamicValues = Math.round(getDistributedValueF(1, dynamicIdx.length, level, DISTMIN, DISTMAX)) * modifier;
        dynamicValues = Math.min(dynamicValues, dynamicIdx.length);
      }
      let bonusValue = Math.max(1, modifier);
      const pool = dynamicIdx.slice();
      for (let i = dynamicValues; --i > -1;) {
        if (!pool.length) break;
        const key = RNG.int(pool.length - 1);
        const attr = pool[key];
        const rec = values[attr];
        const { min, max, precision } = rec;
        let value = getDistributedValueF(min, max, level, DISTMIN, DISTMAX);
        if (precision === 0) value = Math.round(value);
        const pct = getValuePercentage(min, max, value);
        const pctMax = Math.max(1, bonusValue);
        rec.value = value; rec.pct = pct; rec.pctMax = pctMax;
        if (Math.abs(min) >= EPSILON && Math.abs(max) >= EPSILON) {
          const vMin = getModifierValue(min, max, pctMax - 1);
          const vMax = getModifierValue(min, max, pctMax);
          let v2 = getPercentageValueF(vMin, vMax, pct);
          if (precision === 0) v2 = Math.round(v2);
          rec.value = v2;
          bonusValue = getDistributedValueF(1, modifier, level, DISTMIN, DISTMAX);
        }
        pool.splice(key, 1);
      }
    }

    // setDamageValues (component branch): ensure min<=max for damage
    if (values['mindamage'] && values['maxdamage']) {
      const mn = values['mindamage'], mx = values['maxdamage'];
      if (mx.value < mn.value) { const t = mx.value; mx.value = mn.value; mn.value = t; }
    }

    let tierName = '';
    if (modifier > BonusType.EXCEPTIONAL + 1) tierName = 'Legendary';
    else if (modifier > BonusType.ENHANCED + 1) tierName = 'Exceptional';
    else if (modifier > BonusType.EXPERIMENTAL + 1) tierName = 'Enhanced';
    else if (modifier > BonusType.STATIC) tierName = 'Experimental';

    return { level, modifier, tierName, values };
  }

  return { rollLoot, RandomType, BonusType, LEVELMAX, getLevelRankValue };
})();

/* -------- Experimentation failure rate (display info) ------------------- */
function calculateExperimentationFailureRate(slots, expSkill, pointsUsed) {
  const ma = getWeightedValue(slots, 'res_malleability');
  const expPoints = expSkill / 10.0;
  return Math.trunc(50.0 + (ma - 500.0) / 40.0 + expPoints - 5.0 * pointsUsed);
}
