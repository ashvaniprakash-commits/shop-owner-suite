import { parseProductNameAndPrice } from "./price-parser";

/**
 * Parse free-form text into { name, price } items.
 * Handles inputs like:
 *   "Milk 50, Bread 30"
 *   "Rice दो सौ पचहत्तर"
 *   "दूध पचपन"
 */
export type ParsedItem = { name: string; price: number };

export function parseItems(input: string): ParsedItem[] {
  if (!input.trim()) return [];
  const segments = input
    .split(/[,;\n]|\sand\s/i)
    .map((s) => s.trim())
    .filter(Boolean);

  const items: ParsedItem[] = [];
  for (const seg of segments) {
    const cleaned = seg.replace(/(rupees?|rs\.?|inr|usd|dollars?|\$|₹|€|£)/gi, " ").trim();
    const parsed = parseProductNameAndPrice(cleaned);

    if (parsed.price !== null && parsed.productName) {
      items.push({ name: titleCase(parsed.productName), price: parsed.price });
      continue;
    }

    if (parsed.price !== null) {
      items.push({ name: titleCase(cleaned), price: parsed.price });
      continue;
    }

    const numericMatch = cleaned.match(/(\d+(?:\.\d+)?)/);
    if (numericMatch) {
      const name = cleaned.replace(numericMatch[0], "").trim();
      const price = Number(numericMatch[0]);
      if (name && !Number.isNaN(price)) {
        items.push({ name: titleCase(name), price });
      }
    }
  }

  return items;
}

function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\s+/g, " ").trim();
}
