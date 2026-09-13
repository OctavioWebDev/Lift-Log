export interface FoodSearchResult {
  name: string;
  brand: string;
  gramsPerServing: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

// USDA FoodData Central proxy — shared by the web and mobile API routes.
export async function searchFoods(query: string): Promise<FoodSearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(q)}&api_key=${process.env.USDA_API_KEY}&dataType=Branded&pageSize=20`;
  const response = await fetch(url);
  const data = (await response.json()) as any;
  return (data.foods || [])
    .filter((f: any) => f.description && f.foodNutrients?.length)
    .map((f: any) => {
      const nutrient = (name: string) =>
        f.foodNutrients.find((n: any) => n.nutrientName === name)?.value || 0;
      const gramsPerServing = f.servingSize || 100;
      return {
        name: f.description,
        brand: f.brandOwner || f.brandName || "",
        gramsPerServing,
        calories: Math.round(nutrient("Energy")),
        protein: Math.round(nutrient("Protein") * 10) / 10,
        carbs: Math.round(nutrient("Carbohydrate, by difference") * 10) / 10,
        fat: Math.round(nutrient("Total lipid (fat)") * 10) / 10,
      };
    });
}
