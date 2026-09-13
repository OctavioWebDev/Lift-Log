import { storage } from "./storage";
import type { FoodCacheEntry } from "@shared/schema";

export interface FoodSearchResult {
  fdcId?: number;
  name: string;
  brand: string;
  gramsPerServing: number;
  servingUnit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

const MAX_RESULTS = 20;
// A generous ceiling, not a strict nutritional limit — just enough to catch
// obvious data-entry errors (e.g. a misplaced decimal) without rejecting
// legitimate high-calorie bulk/multi-serving branded items.
const MAX_PLAUSIBLE_CALORIES = 9000;

function fromCacheRow(row: FoodCacheEntry): FoodSearchResult {
  return {
    fdcId: row.fdcId,
    name: row.name,
    brand: row.brand || "",
    gramsPerServing: row.servingSize,
    servingUnit: row.servingUnit,
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
  };
}

// Filters out USDA entries with missing/negative/implausible macro data and
// normalizes units before they're shown to a user or written to our cache.
function sanitizeUsdaFood(f: any): (FoodSearchResult & { fdcId: number }) | null {
  if (!f.fdcId || !f.description || !f.foodNutrients?.length) return null;

  const nutrient = (name: string): number | undefined =>
    f.foodNutrients.find((n: any) => n.nutrientName === name)?.value;
  const calories = nutrient("Energy");
  const protein = nutrient("Protein");
  const carbs = nutrient("Carbohydrate, by difference");
  const fat = nutrient("Total lipid (fat)");

  const values = [calories, protein, carbs, fat];
  if (values.every((v) => !v)) return null; // no usable macro data at all
  if (values.some((v) => v != null && v < 0)) return null; // corrupt entry
  if (calories != null && calories > MAX_PLAUSIBLE_CALORIES) return null;

  return {
    fdcId: f.fdcId,
    name: f.description,
    brand: f.brandOwner || f.brandName || "",
    gramsPerServing: f.servingSize || 100,
    servingUnit: (f.servingSizeUnit || "g").toLowerCase(),
    calories: Math.round(calories || 0),
    protein: Math.round((protein || 0) * 10) / 10,
    carbs: Math.round((carbs || 0) * 10) / 10,
    fat: Math.round((fat || 0) * 10) / 10,
  };
}

// USDA FoodData Central proxy — shared by the web and mobile API routes.
// Searches our own sanitized cache first (fast, and works even if USDA is
// down or rate-limited), then supplements with live USDA results, which are
// sanitized and cached for next time before being returned.
export async function searchFoods(query: string): Promise<FoodSearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  const results = new Map<number, FoodSearchResult>();
  const cached = await storage.searchCachedFoods(q, MAX_RESULTS);
  for (const row of cached) results.set(row.fdcId, fromCacheRow(row));

  if (results.size < MAX_RESULTS) {
    try {
      const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(q)}&api_key=${process.env.USDA_API_KEY}&dataType=Branded&pageSize=20`;
      const response = await fetch(url);
      const data = (await response.json()) as any;

      for (const raw of data.foods || []) {
        const sanitized = sanitizeUsdaFood(raw);
        if (!sanitized || results.has(sanitized.fdcId)) continue;
        results.set(sanitized.fdcId, sanitized);
        // Fire-and-forget: a caching hiccup should never break search itself.
        storage
          .upsertCachedFood({
            fdcId: sanitized.fdcId,
            name: sanitized.name,
            brand: sanitized.brand || null,
            servingSize: sanitized.gramsPerServing,
            servingUnit: sanitized.servingUnit,
            calories: sanitized.calories,
            protein: sanitized.protein,
            carbs: sanitized.carbs,
            fat: sanitized.fat,
          })
          .catch((err) => console.error("Failed to cache food entry:", err));
      }
    } catch (error) {
      console.error("USDA food search failed, falling back to cached results:", error);
    }
  }

  return Array.from(results.values()).slice(0, MAX_RESULTS);
}
