export const ALLERGENS: Record<string, string> = {
  "1": "Obiloviny (lepek)",
  "2": "Korýši (např. krevety, krabi)",
  "3": "Vejce",
  "4": "Ryby",
  "5": "Arašíd (buráky)",
  "6": "Sója",
  "7": "Mléko (laktóza)",
  "8": "Skořápkové ořechy",
  "9": "Celer",
  "10": "Hořčice",
  "11": "Sezam",
  "12": "Oxid siřičitý a siřičitany",
  "13": "Lupina",
  "14": "Měkkýši (měkkýši)",
};

export function getAllergenDescriptions(codes: string[] = []): string[] {
  return codes.map((c) => ALLERGENS[c] ?? `Neznámý alergen (${c})`);
}
