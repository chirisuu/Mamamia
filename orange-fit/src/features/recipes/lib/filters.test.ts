import { describe, expect, it } from "vitest";
import { activeFilterCount, filterRecipes, filtersToSearchParams, parseRecipeFilters } from "./filters";
import { card } from "./test-fixtures";

const avena = card({ id: "avena", title: "Avena con plátano", allergens: ["gluten", "lactosa"], diet_tags: ["vegetarian", "quick"], meal_types: ["breakfast"], prep_minutes: 5, cook_minutes: 10, estimated_cost: 2.5, servings: 1 }, { per_serving_energy_kcal: 350, per_serving_protein_g: 12 });
const ceviche = card({ id: "ceviche", title: "Ceviche de pescado", description: "Clásico peruano", allergens: ["pescado"], diet_tags: ["high_protein", "low_carb"], meal_types: ["lunch"], prep_minutes: 30, cook_minutes: 0, estimated_cost: 24, servings: 4, tags: ["marino"] }, { per_serving_energy_kcal: 250, per_serving_protein_g: 30 });
const tofu = card({ id: "tofu", title: "Salteado de tofu", allergens: ["soya"], diet_tags: ["vegan", "vegetarian"], meal_types: ["dinner", "lunch"], prep_minutes: null, cook_minutes: null, estimated_cost: null }, { per_serving_energy_kcal: 420, per_serving_protein_g: 22 });
const propia = card({ id: "propia", title: "Mi ensalada", owner_id: "u1", status: "draft", is_public: false, allergens: [], diet_tags: [], meal_types: ["lunch"], prep_minutes: null, cook_minutes: null, estimated_cost: null }, {}, "u1");
const all = [avena, ceviche, tofu, propia];

describe("parseRecipeFilters", () => {
  it("usa los alérgenos del objetivo cuando la URL no dice nada", () => {
    const f = parseRecipeFilters({}, ["gluten", "Frutos secos"]);
    expect(f.excludeAllergens).toEqual(["gluten", "frutos_secos"]);
    expect(f.allergensFromGoal).toBe(true);
  });

  it("`sin=` vacío significa no excluir nada aunque el objetivo tenga alérgenos", () => {
    const f = parseRecipeFilters(new URLSearchParams("sin="), ["gluten"]);
    expect(f.excludeAllergens).toEqual([]);
    expect(f.allergensFromGoal).toBe(false);
  });

  it("lee y sanea los parámetros", () => {
    const f = parseRecipeFilters({ q: "  pollo ", comida: "lunch", dieta: "vegan,raro,vegan", sin: "huevo,xyz", tiempo: "30", costo: "abc", favoritas: "1", orden: "proteina" });
    expect(f).toMatchObject({ q: "pollo", mealType: "lunch", diet: ["vegan"], excludeAllergens: ["huevo"], maxMinutes: 30, maxCost: null, favorites: true, mine: false, sort: "proteina" });
    expect(parseRecipeFilters({ comida: "custom", orden: "x" })).toMatchObject({ mealType: null, sort: "nombre" });
  });

  it("vuelve a escribir la URL sin repetir los alérgenos del objetivo", () => {
    const f = parseRecipeFilters({ q: "avena" }, ["gluten"]);
    expect(filtersToSearchParams(f).toString()).toBe("q=avena");
    expect(filtersToSearchParams({ ...f, allergensFromGoal: false, excludeAllergens: [] }).toString()).toBe("q=avena&sin=");
    expect(activeFilterCount(f)).toBe(1);
  });
});

describe("filterRecipes", () => {
  const base = parseRecipeFilters(new URLSearchParams("sin="));

  it("busca sin tildes en título, descripción y etiquetas", () => {
    expect(filterRecipes(all, { ...base, q: "platano" }).map((c) => c.id)).toEqual(["avena"]);
    expect(filterRecipes(all, { ...base, q: "peruano" }).map((c) => c.id)).toEqual(["ceviche"]);
    expect(filterRecipes(all, { ...base, q: "MARINO" }).map((c) => c.id)).toEqual(["ceviche"]);
  });

  it("excluye alérgenos y filtra por comida y dieta (vegetariana acepta vegana)", () => {
    expect(filterRecipes(all, { ...base, excludeAllergens: ["gluten", "pescado"] }).map((c) => c.id)).toEqual(["propia", "tofu"]);
    expect(filterRecipes(all, { ...base, mealType: "lunch" }).map((c) => c.id)).toEqual(["ceviche", "propia", "tofu"]);
    expect(filterRecipes(all, { ...base, diet: ["vegetarian"] }).map((c) => c.id)).toEqual(["avena", "tofu"]);
    expect(filterRecipes(all, { ...base, diet: ["vegetarian", "quick"] }).map((c) => c.id)).toEqual(["avena"]);
  });

  it("tiempo y costo máximo excluyen recetas sin dato; el costo es por porción", () => {
    expect(filterRecipes(all, { ...base, maxMinutes: 20 }).map((c) => c.id)).toEqual(["avena"]);
    // Ceviche: S/ 24 / 4 porciones = S/ 6 por porción.
    expect(filterRecipes(all, { ...base, maxCost: 6 }).map((c) => c.id)).toEqual(["avena", "ceviche"]);
    expect(filterRecipes(all, { ...base, maxCost: 5 }).map((c) => c.id)).toEqual(["avena"]);
  });

  it("favoritas, propias y orden", () => {
    expect(filterRecipes(all, { ...base, favorites: true }, new Set(["tofu"])).map((c) => c.id)).toEqual(["tofu"]);
    expect(filterRecipes(all, { ...base, mine: true }).map((c) => c.id)).toEqual(["propia"]);
    expect(filterRecipes(all, { ...base, sort: "proteina" })[0]!.id).toBe("ceviche");
    // Sin costo al final; empate por título.
    expect(filterRecipes(all, { ...base, sort: "costo" }).map((c) => c.id)).toEqual(["avena", "ceviche", "propia", "tofu"]);
  });
});
