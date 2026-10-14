#!/usr/bin/env node
// Valida los seeds de supabase/seed sin base de datos.
// Uso: node scripts/check-seed.mjs [carpeta]   (por defecto supabase/seed)
//
// Comprueba:
//  1. Columnas usadas vs docs/DATA_MODEL.md (y vs supabase/migrations si existen) y valores de enums.
//  2. Duplicados (name_normalized, slugs, precios) y una porción por defecto por alimento.
//  3. Que cada porción, ingrediente y precio apunte a un alimento del seed (y cada ingrediente a una receta).
//  4. Coherencia de macros: 4·P + 4·C + 9·G dentro de ±15 % de energy_kcal (o con fibra a 2 kcal/g,
//     o ±5 kcal en alimentos de muy baja energía). Las excepciones conocidas se listan con su motivo.
//  5. Rangos (checks de la migración), procedencia honesta (nunca 'verified') y etiquetas de recetas
//     (vegetariana/vegana, alérgenos, high_protein, low_carb) recalculadas desde los ingredientes.
// Sale con código 1 si hay errores.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : join(root, 'supabase/seed');
const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

// Igual que public.normalize_text(): unaccent + espacios colapsados + trim + minúsculas.
const normalize = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

// ----------------------------------------------------------------------------- contrato
const model = readFileSync(join(root, 'docs/DATA_MODEL.md'), 'utf8');
function contractColumns(table) {
  const m = model.match(new RegExp(`\\*\\*${table}\\*\\*\\s*—([\\s\\S]*?)\\.(?:\\s*\\n|\\s+[A-Z])`));
  if (!m) throw new Error(`No encuentro la tabla ${table} en DATA_MODEL.md`);
  let body = m[1];
  // quita paréntesis (tipos, comentarios) de forma repetida por si hay anidados
  for (let i = 0; i < 3; i++) body = body.replace(/\([^()]*\)/g, '');
  const cols = new Set(['id', 'created_at', 'updated_at']);
  for (const piece of body.split(',')) {
    const word = piece.trim().match(/^([a-z_]+(?:\/[a-z_]+)*)/);
    if (word) word[1].split('/').forEach((c) => cols.add(c));
  }
  return cols;
}
function contractEnum(name) {
  const m = model.match(new RegExp(`\\|\\s*${name}\\s*\\|([^|]+)\\|`));
  if (!m) throw new Error(`No encuentro el enum ${name}`);
  return new Set(m[1].split(',').map((s) => s.trim()));
}
const TABLES = ['foods', 'food_portions', 'reference_prices', 'recipes', 'recipe_ingredients'];
const contract = Object.fromEntries(TABLES.map((t) => [t, contractColumns(t)]));
const ENUMS = {
  meal_type: contractEnum('meal_type'),
  food_source: contractEnum('food_source'),
  verification_status: contractEnum('verification_status'),
  recipe_status: contractEnum('recipe_status'),
};

// Columnas reales de las migraciones (si existen).
const migDir = join(root, 'supabase/migrations');
const migrationCols = {};
if (existsSync(migDir)) {
  const sqlAll = readdirSync(migDir).filter((f) => f.endsWith('.sql')).map((f) => readFileSync(join(migDir, f), 'utf8')).join('\n');
  for (const t of TABLES) {
    const m = sqlAll.match(new RegExp(`create table public\\.${t} \\(([\\s\\S]*?)\\n\\);`));
    if (!m) continue;
    migrationCols[t] = new Set(
      m[1].split('\n').map((l) => l.trim().match(/^([a-z_]+)\s+[a-z]/)).filter(Boolean).map((x) => x[1])
        .filter((c) => !['check', 'primary', 'unique', 'constraint', 'foreign'].includes(c)),
    );
  }
}

// ----------------------------------------------------------------------------- parser SQL mínimo
function stripComments(sql) {
  let out = '';
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "'") {
      const j = endOfString(sql, i);
      out += sql.slice(i, j + 1);
      i = j;
    } else if (ch === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') i++;
      out += '\n';
    } else out += ch;
  }
  return out;
}
function endOfString(s, i) {
  let j = i + 1;
  for (;;) {
    if (j >= s.length) throw new Error('cadena sin cerrar');
    if (s[j] === "'") {
      if (s[j + 1] === "'") j += 2;
      else return j;
    } else j++;
  }
}
function splitStatements(sql) {
  const out = [];
  let cur = '';
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "'") {
      const j = endOfString(sql, i);
      cur += sql.slice(i, j + 1);
      i = j;
    } else if (ch === '$' && sql[i + 1] === '$') {
      const j = sql.indexOf('$$', i + 2);
      cur += sql.slice(i, j + 2);
      i = j + 1;
    } else if (ch === ';') {
      if (cur.trim()) out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
// Divide por comas de primer nivel (respeta paréntesis y cadenas).
function splitTop(s) {
  const parts = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "'") {
      const j = endOfString(s, i);
      cur += s.slice(i, j + 1);
      i = j;
      continue;
    }
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}
function parseTuples(s) {
  const tuples = [];
  let i = 0;
  while (i < s.length) {
    while (i < s.length && /[\s,]/.test(s[i])) i++;
    if (i >= s.length) break;
    if (s[i] !== '(') throw new Error(`se esperaba "(" cerca de: ${s.slice(i, i + 60)}`);
    let depth = 0;
    let j = i;
    for (; j < s.length; j++) {
      if (s[j] === "'") {
        j = endOfString(s, j);
        continue;
      }
      if (s[j] === '(') depth++;
      if (s[j] === ')') {
        depth--;
        if (depth === 0) break;
      }
    }
    tuples.push(s.slice(i + 1, j));
    i = j + 1;
  }
  return tuples;
}
function parseValue(expr) {
  const e = expr.trim();
  if (/^null$/i.test(e)) return null;
  if (/^true$/i.test(e)) return true;
  if (/^false$/i.test(e)) return false;
  if (/^-?\d+(\.\d+)?$/.test(e)) return Number(e);
  if (e.startsWith("'") && endOfString(e, 0) === e.length - 1) return e.slice(1, -1).replace(/''/g, "'");
  let m = e.match(/^\(select id from public\.foods where name_normalized = '((?:[^']|'')*)' and created_by is null\)$/i);
  if (m) return { ref: 'foods', key: m[1].replace(/''/g, "'") };
  m = e.match(/^\(select id from public\.recipes where slug = '((?:[^']|'')*)'\)$/i);
  if (m) return { ref: 'recipes', key: m[1].replace(/''/g, "'") };
  throw new Error(`expresión no reconocida: ${e.slice(0, 80)}`);
}
const pgArray = (s) => {
  if (typeof s !== 'string' || !/^\{.*\}$/.test(s)) return null;
  const inner = s.slice(1, -1);
  if (!inner) return [];
  return inner.split(',').map((x) => x.replace(/^"|"$/g, ''));
};

const rows = Object.fromEntries(TABLES.map((t) => [t, []]));
const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.sql')).sort() : [];
if (!files.length) err(`No hay archivos .sql en ${dir}`);
for (const f of files) {
  const sql = stripComments(readFileSync(join(dir, f), 'utf8'));
  for (const st of splitStatements(sql)) {
    if (/^(begin|commit)$/i.test(st) || /^do \$\$/i.test(st)) continue;
    const m = st.match(/^insert into public\.(\w+)\s*\(([^)]*)\)\s*values\s*([\s\S]*)$/i);
    if (!m) {
      err(`${f}: sentencia no reconocida: ${st.slice(0, 80)}`);
      continue;
    }
    const [, table, colList, valuesPart] = m;
    if (!rows[table]) {
      err(`${f}: tabla inesperada ${table}`);
      continue;
    }
    const cols = colList.split(',').map((c) => c.trim());
    for (const c of cols) {
      if (!contract[table].has(c)) err(`${f}: ${table}.${c} no está en DATA_MODEL.md`);
      if (migrationCols[table] && !migrationCols[table].has(c)) err(`${f}: ${table}.${c} no existe en las migraciones`);
    }
    for (const t of parseTuples(valuesPart)) {
      const vals = splitTop(t).map(parseValue);
      if (vals.length !== cols.length) {
        err(`${f}: ${table} fila con ${vals.length} valores para ${cols.length} columnas`);
        continue;
      }
      rows[table].push({ __file: f, ...Object.fromEntries(cols.map((c, i) => [c, vals[i]])) });
    }
  }
}

// ----------------------------------------------------------------------------- foods
const foods = new Map();
const MACRO_EXCEPTIONS = {
  // Motivo por el que 4/4/9 no cuadra (la energía de la fuente usa otros factores o componentes).
  'cerveza': 'el alcohol aporta ~7 kcal/g y no figura en proteína, carbohidratos ni grasa',
  'limon, jugo': 'los ácidos orgánicos (cítrico) cuentan como carbohidrato pero aportan ~2,5 kcal/g',
  'vinagre': 'la energía viene del ácido acético, que no figura en los macros',
};
for (const r of rows.foods) {
  const name = r.name;
  const nn = r.name_normalized;
  if (nn !== normalize(name)) err(`foods: name_normalized "${nn}" no coincide con normalize_text("${name}") = "${normalize(name)}"`);
  if (foods.has(nn)) err(`foods: name_normalized duplicado "${nn}"`);
  foods.set(nn, r);
  if (!['generic', 'branded', 'dish'].includes(r.food_type)) err(`foods ${name}: food_type inválido ${r.food_type}`);
  if (!ENUMS.food_source.has(r.source)) err(`foods ${name}: source inválido`);
  if (r.source !== 'curated') err(`foods ${name}: source debe ser 'curated' (es ${r.source})`);
  if (!ENUMS.verification_status.has(r.verification_status)) err(`foods ${name}: verification_status inválido`);
  if (r.verification_status !== 'unverified') err(`foods ${name}: verification_status debe ser 'unverified'`);
  if (r.created_by !== null) err(`foods ${name}: created_by debe ser null`);
  if (r.is_public !== true) err(`foods ${name}: is_public debe ser true`);
  if (!r.source_ref || !/pendiente de verifica/.test(r.source_ref)) err(`foods ${name}: source_ref debe explicar la referencia y que está pendiente de verificar`);
  if (/^(Valor aproximado basado en USDA|Aproximación con un alimento análogo de USDA)/.test(r.source_ref ?? '') && !/Dominio público/.test(r.license ?? '')) {
    err(`foods ${name}: cita USDA sin licencia de dominio público`);
  }
  if (r.food_type === 'dish' && r.source_ref !== 'Estimación por receta estándar — pendiente de verificación') err(`foods ${name}: un plato debe usar el source_ref de estimación por receta`);
  const cc = pgArray(r.country_codes);
  if (!cc || !cc.length || cc.some((c) => !/^[A-Z]{2}$/.test(c))) err(`foods ${name}: country_codes inválido ${r.country_codes}`);
  const v = (k) => r[k];
  for (const k of ['energy_kcal', 'protein_g', 'carbs_g', 'fat_g']) if (typeof v(k) !== 'number') err(`foods ${name}: ${k} requerido`);
  if (v('energy_kcal') < 0 || v('energy_kcal') > 900) err(`foods ${name}: energy_kcal fuera de 0–900`);
  for (const k of ['protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sugar_g', 'saturated_fat_g']) {
    if (v(k) !== null && (v(k) < 0 || v(k) > 100)) err(`foods ${name}: ${k} fuera de 0–100`);
  }
  if (v('sodium_mg') !== null && (v('sodium_mg') < 0 || v('sodium_mg') > 100000)) err(`foods ${name}: sodium_mg fuera de rango`);
  if (v('protein_g') + v('carbs_g') + v('fat_g') > 100.5) err(`foods ${name}: P+C+G > 100 g`);
  if (v('sugar_g') !== null && v('sugar_g') > v('carbs_g') + 0.01) err(`foods ${name}: azúcar > carbohidratos`);
  if (v('fiber_g') !== null && v('fiber_g') > v('carbs_g') + 0.01) err(`foods ${name}: fibra > carbohidratos`);
  if (v('saturated_fat_g') !== null && v('saturated_fat_g') > v('fat_g') + 0.01) err(`foods ${name}: grasa saturada > grasa`);
  if (v('density_g_per_ml') !== null && !(v('density_g_per_ml') > 0.5 && v('density_g_per_ml') < 2)) err(`foods ${name}: densidad rara`);

  const kcal = v('energy_kcal');
  const calc = 4 * v('protein_g') + 4 * v('carbs_g') + 9 * v('fat_g');
  const fib = v('fiber_g') ?? 0;
  const calcFib = 4 * v('protein_g') + 4 * (v('carbs_g') - fib) + 2 * fib + 9 * v('fat_g');
  const within = (c) => Math.abs(c - kcal) <= 0.15 * kcal || Math.abs(c - kcal) <= 5;
  r.__macro = { calc, calcFib };
  if (!within(calc) && !within(calcFib)) {
    if (MACRO_EXCEPTIONS[nn]) warn(`macros (excepción explicada) ${name}: ${kcal} kcal vs 4/4/9 = ${calc.toFixed(0)} → ${MACRO_EXCEPTIONS[nn]}`);
    else err(`macros ${name}: ${kcal} kcal vs 4/4/9 = ${calc.toFixed(1)} (con fibra a 2 kcal/g: ${calcFib.toFixed(1)}) fuera de ±15 %`);
  } else if (MACRO_EXCEPTIONS[nn]) warn(`excepción de macros innecesaria: ${name}`);
}

// ----------------------------------------------------------------------------- porciones
const defaults = new Map();
for (const r of rows.food_portions) {
  const ref = r.food_id;
  if (!ref || ref.ref !== 'foods' || !foods.has(ref.key)) {
    err(`food_portions: referencia a alimento inexistente ${JSON.stringify(ref)}`);
    continue;
  }
  if (!(r.gram_weight > 0) || r.gram_weight > 3000) err(`food_portions ${ref.key} "${r.label}": gram_weight ${r.gram_weight} fuera de rango`);
  if (!(r.quantity > 0)) err(`food_portions ${ref.key}: quantity debe ser > 0`);
  if (!r.label || r.label.length > 80) err(`food_portions ${ref.key}: label vacío o > 80`);
  if (!r.unit || r.unit.length > 30) err(`food_portions ${ref.key}: unit vacío o > 30`);
  if (r.is_default) defaults.set(ref.key, (defaults.get(ref.key) ?? 0) + 1);
}
for (const nn of foods.keys()) {
  const n = defaults.get(nn) ?? 0;
  if (n !== 1) err(`food_portions: ${nn} tiene ${n} porciones por defecto (debe ser 1)`);
}

// ----------------------------------------------------------------------------- recetas
const KNOWN_DIET = new Set(['vegetarian', 'vegan', 'high_protein', 'low_carb', 'budget', 'quick']);
const KNOWN_ALLERGENS = new Set(['gluten', 'lactosa', 'huevo', 'pescado', 'mariscos', 'mani', 'frutos_secos', 'soya', 'sesamo']);
// Mapa independiente (por nombre) para recalcular alérgenos y carácter vegetariano/vegano.
const ALLERGEN_RULES = [
  ['gluten', /^(pan |fideos|harina de trigo|galletas|sillao|avena)/],
  ['lactosa', /^(leche|yogurt|queso|mantequilla con sal|manjar)/],
  ['huevo', /^(huevo|clara de huevo|mayonesa)/],
  ['pescado', /^(bonito|jurel|caballa|perico|tilapia|trucha|merluza|atun|sardinas)/],
  ['mariscos', /^(pota|langostinos|conchas|choros)/],
  ['mani', /^(mani|mantequilla de mani)/],
  ['frutos_secos', /^(almendras|nueces)/],
  ['soya', /^(tofu|sillao|bebida de soya)/],
];
const MEAT_FISH = /^(pechuga|pierna|pollo|carne|lomo|higado|corazon|salchicha|bonito|jurel|caballa|perico|tilapia|trucha|merluza|atun|sardinas|pota|langostinos|conchas|choros)/;
const ANIMAL_OTHER = /^(huevo|clara de huevo|mayonesa|leche|yogurt|queso|mantequilla con sal|manjar|miel)/;
const recipes = new Map();
for (const r of rows.recipes) {
  if (recipes.has(r.slug)) err(`recipes: slug duplicado ${r.slug}`);
  recipes.set(r.slug, { ...r, ings: [] });
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.slug)) err(`recipes ${r.slug}: slug inválido`);
  if (r.owner_id !== null) err(`recipes ${r.slug}: owner_id debe ser null`);
  if (r.status !== 'published' || !ENUMS.recipe_status.has(r.status)) err(`recipes ${r.slug}: status debe ser 'published'`);
  if (r.is_public !== true) err(`recipes ${r.slug}: is_public debe ser true`);
  if (r.image_path !== null) err(`recipes ${r.slug}: image_path debe ser null`);
  if (r.country_code !== 'PE' || r.cost_currency !== 'PEN') err(`recipes ${r.slug}: country_code/cost_currency`);
  if (!['easy', 'medium', 'hard'].includes(r.difficulty)) err(`recipes ${r.slug}: difficulty inválido`);
  if (!(r.servings > 0)) err(`recipes ${r.slug}: servings`);
  if (!(r.estimated_cost >= 0)) err(`recipes ${r.slug}: estimated_cost`);
  let steps;
  try {
    steps = JSON.parse(r.steps);
  } catch {
    err(`recipes ${r.slug}: steps no es JSON`);
  }
  if (!Array.isArray(steps) || !steps.length || steps.some((s) => typeof s !== 'string' || s.length < 10)) err(`recipes ${r.slug}: steps debe ser un array de textos`);
  for (const mt of pgArray(r.meal_types) ?? ['?']) if (!ENUMS.meal_type.has(mt)) err(`recipes ${r.slug}: meal_type inválido ${mt}`);
  for (const d of pgArray(r.diet_tags) ?? ['?']) if (!KNOWN_DIET.has(d)) err(`recipes ${r.slug}: diet_tag desconocido ${d}`);
  for (const a of pgArray(r.allergens) ?? ['?']) if (!KNOWN_ALLERGENS.has(a)) err(`recipes ${r.slug}: alérgeno desconocido ${a}`);
}
for (const r of rows.recipe_ingredients) {
  const rec = r.recipe_id?.ref === 'recipes' ? recipes.get(r.recipe_id.key) : null;
  const food = r.food_id?.ref === 'foods' ? foods.get(r.food_id.key) : null;
  if (!rec) err(`recipe_ingredients: receta inexistente ${JSON.stringify(r.recipe_id)}`);
  if (!food) err(`recipe_ingredients: alimento inexistente ${JSON.stringify(r.food_id)} (receta ${r.recipe_id?.key})`);
  if (!(r.grams > 0)) err(`recipe_ingredients ${r.recipe_id?.key}: grams debe ser > 0`);
  if (r.display_quantity !== null && !(r.display_quantity > 0)) err(`recipe_ingredients ${r.recipe_id?.key}: display_quantity > 0`);
  if (rec && food) rec.ings.push({ ...r, food });
}
for (const rec of recipes.values()) {
  if (!rec.ings.length) {
    err(`recipes ${rec.slug}: sin ingredientes`);
    continue;
  }
  const positions = rec.ings.map((x) => x.position);
  if (new Set(positions).size !== positions.length) err(`recipes ${rec.slug}: posiciones repetidas`);
  const tot = { kcal: 0, p: 0, c: 0 };
  const allergens = new Set();
  let meat = false;
  let animalOther = false;
  for (const ing of rec.ings) {
    const f = ing.food;
    if (f.food_type === 'dish') err(`recipes ${rec.slug}: usa un plato (${f.name}) como ingrediente`);
    tot.kcal += (ing.grams * f.energy_kcal) / 100;
    tot.p += (ing.grams * f.protein_g) / 100;
    tot.c += (ing.grams * f.carbs_g) / 100;
    const nn = f.name_normalized;
    for (const [a, re] of ALLERGEN_RULES) if (re.test(nn)) allergens.add(a);
    if (MEAT_FISH.test(nn)) meat = true;
    if (ANIMAL_OTHER.test(nn)) animalOther = true;
  }
  const per = { kcal: tot.kcal / rec.servings, p: tot.p / rec.servings, c: tot.c / rec.servings };
  const diet = new Set(pgArray(rec.diet_tags));
  const declared = new Set(pgArray(rec.allergens));
  for (const a of allergens) if (!declared.has(a)) err(`recipes ${rec.slug}: falta alérgeno ${a}`);
  for (const a of declared) if (!allergens.has(a)) warn(`recipes ${rec.slug}: alérgeno ${a} declarado sin ingrediente que lo explique`);
  if (diet.has('vegetarian') && meat) err(`recipes ${rec.slug}: marcada vegetarian pero lleva carne o pescado`);
  if (!diet.has('vegetarian') && !meat) err(`recipes ${rec.slug}: no lleva carne ni pescado pero no está marcada vegetarian`);
  if (diet.has('vegan') && (meat || animalOther)) err(`recipes ${rec.slug}: marcada vegan pero lleva ingredientes animales`);
  if (!diet.has('vegan') && !meat && !animalOther) err(`recipes ${rec.slug}: es vegana pero no está marcada vegan`);
  const hp = per.p >= 20 && (4 * per.p) / per.kcal >= 0.25;
  if (diet.has('high_protein') !== hp) err(`recipes ${rec.slug}: high_protein no coincide (proteína ${per.p.toFixed(1)} g/porción)`);
  if (diet.has('low_carb') !== per.c <= 20) err(`recipes ${rec.slug}: low_carb no coincide (carbos ${per.c.toFixed(1)} g/porción)`);
  const quick = rec.prep_minutes + rec.cook_minutes <= 20;
  if (diet.has('quick') && !quick) err(`recipes ${rec.slug}: quick con ${rec.prep_minutes + rec.cook_minutes} min`);
  if (diet.has('budget') && rec.estimated_cost / rec.servings > 5.005) err(`recipes ${rec.slug}: budget con S/ ${(rec.estimated_cost / rec.servings).toFixed(2)} por porción`);
  if (per.kcal < 80 || per.kcal > 1100) warn(`recipes ${rec.slug}: ${per.kcal.toFixed(0)} kcal por porción, revisar`);
}

// ----------------------------------------------------------------------------- precios
const priceItems = new Set();
for (const r of rows.reference_prices) {
  if (priceItems.has(r.item_name)) err(`reference_prices: item repetido ${r.item_name}`);
  priceItems.add(r.item_name);
  if (!r.food_id || r.food_id.ref !== 'foods' || !foods.has(r.food_id.key)) err(`reference_prices ${r.item_name}: alimento inexistente ${JSON.stringify(r.food_id)}`);
  if (r.country_code !== 'PE' || r.currency_code !== 'PEN') err(`reference_prices ${r.item_name}: país/moneda`);
  if (!['kg', 'l', 'unit'].includes(r.per_unit)) err(`reference_prices ${r.item_name}: per_unit inválido`);
  if (!(r.price > 0 && r.price < 1000)) err(`reference_prices ${r.item_name}: precio fuera de rango`);
  if (!(r.per_quantity > 0)) err(`reference_prices ${r.item_name}: per_quantity`);
  if (r.source !== 'Referencial inicial sin fuente verificada — actualizar en /admin') err(`reference_prices ${r.item_name}: source`);
  if (r.observed_on !== '2026-10-01') err(`reference_prices ${r.item_name}: observed_on`);
  if (r.created_by !== null) err(`reference_prices ${r.item_name}: created_by debe ser null`);
}

// ----------------------------------------------------------------------------- reporte
const count = (t) => rows[t].length;
console.log(`Archivos: ${files.join(', ')}`);
console.log(`foods ${count('foods')} (platos ${rows.foods.filter((f) => f.food_type === 'dish').length}) · food_portions ${count('food_portions')} · recipes ${count('recipes')} · recipe_ingredients ${count('recipe_ingredients')} · reference_prices ${count('reference_prices')}`);
console.log(`Columnas comparadas con DATA_MODEL.md${Object.keys(migrationCols).length ? ' y con supabase/migrations' : ' (sin migraciones para comparar)'}.`);
if (warnings.length) {
  console.log(`\nAvisos (${warnings.length}):`);
  for (const w of warnings) console.log(`  · ${w}`);
}
if (errors.length) {
  console.log(`\nERRORES (${errors.length}):`);
  for (const e of errors) console.log(`  ✗ ${e}`);
  process.exit(1);
}
console.log('\nOK: sin errores.');
