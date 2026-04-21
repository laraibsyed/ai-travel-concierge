// source_handbook: week11-hackathon-preparation
// RAG retrieval logic — keyword match city names from user query,
// return matching city objects to inject into the LLM prompt as context.

import citiesData from "@/data/cities.json";

export type BudgetLevel = "low" | "mid" | "luxury" | "any";

export interface CityData {
  city: string;
  country: string;
  budgets: Record<string, string>;
  attractions: Array<{
    name: string;
    type: string;
    cost: string;
    time: string;
    area: string;
  }>;
  food: Array<{
    name: string;
    type: string;
    cost: string;
    area: string;
  }>;
  tips: string[];
}

const cities = citiesData as CityData[];

/**
 * Simple RAG retrieval: keyword-match city names from the user query.
 * Returns top matching city objects (max 2 to keep prompt tight).
 */
export function retrieveRelevantCities(
  query: string,
  budget: BudgetLevel = "any"
): CityData[] {
  const q = query.toLowerCase();

  // Score each city by how many terms match
  const scored = cities.map((city) => {
    let score = 0;

    // Direct city name match (highest signal)
    if (q.includes(city.city.toLowerCase())) score += 10;

    // Country match
    if (q.includes(city.country.toLowerCase())) score += 5;

    // Fuzzy — common aliases / abbreviations
    const aliases: Record<string, string[]> = {
      dubai: ["uae", "emirates"],
      tokyo: ["japan", "japanese"],
      paris: ["france", "french"],
      london: ["uk", "england", "british"],
      "new york": ["nyc", "manhattan", "usa", "america"],
      madrid: ["spain", "spanish"],
      baku: ["azerbaijan"],
    };

    const cityAliases = aliases[city.city.toLowerCase()] || [];
    for (const alias of cityAliases) {
      if (q.includes(alias)) score += 3;
    }

    return { city, score };
  });

  // Sort by score descending, return top 2 that have any match
  const matched = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((s) => s.city);

  // If no match found, return a random popular city as fallback
  if (matched.length === 0) {
    return [cities[0]]; // Dubai as default
  }

  return matched;
}

/**
 * Serialize retrieved city data into a compact prompt-friendly string.
 * This is what gets injected into the system prompt as RAG context.
 */
export function formatContextForPrompt(
  cities: CityData[],
  budget: BudgetLevel
): string {
  return cities
    .map((city) => {
      const budgetInfo =
        budget !== "any" && city.budgets[budget]
          ? `Budget (${budget}): ${city.budgets[budget]}`
          : `Budgets: low=${city.budgets.low}, mid=${city.budgets.mid}, luxury=${city.budgets.luxury}`;

      // Filter attractions by budget if specified
      const attractions =
        budget !== "any"
          ? city.attractions.filter(
              (a) => a.cost === budget || a.cost === "free"
            )
          : city.attractions;

      const attractionsList = attractions
        .slice(0, 6)
        .map((a) => `  - ${a.name} (${a.area}, ~${a.time}, cost: ${a.cost})`)
        .join("\n");

      const foodList = city.food
        .slice(0, 4)
        .map((f) => `  - ${f.name} (${f.type}, ${f.area})`)
        .join("\n");

      const tipsList = city.tips
        .slice(0, 4)
        .map((t) => `  - ${t}`)
        .join("\n");

      return `=== ${city.city}, ${city.country} ===
${budgetInfo}

Top Attractions:
${attractionsList}

Food Recommendations:
${foodList}

Local Tips:
${tipsList}`;
    })
    .join("\n\n");
}
