/**
 * Parse free-form text into { name, price } items.
 * Handles inputs like:
 *   "Milk 50, Bread 30"
 *   "2 kg sugar 120; rice 200"
 *   "milk fifty rupees, bread thirty"  (basic word numbers)
 *   newline / "and" separated lists
 */
const WORD_NUM: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1000,
};

function wordsToNumber(text: string): number | null {
  const tokens = text.toLowerCase().replace(/[-]/g, " ").split(/\s+/).filter(Boolean);
  let total = 0;
  let current = 0;
  let matched = false;
  for (const t of tokens) {
    if (!(t in WORD_NUM)) continue;
    matched = true;
    const n = WORD_NUM[t];
    if (n === 100 || n === 1000) {
      current = (current || 1) * n;
    } else {
      current += n;
    }
  }
  if (current) total += current;
  return matched ? total : null;
}

export type ParsedItem = { name: string; price: number };

export function parseItems(input: string): ParsedItem[] {
  if (!input.trim()) return [];
  const segments = input
    .split(/[,;\n]|\sand\s/i)
    .map((s) => s.trim())
    .filter(Boolean);

  const items: ParsedItem[] = [];
  for (const seg of segments) {
    // Remove currency words/symbols
    const cleaned = seg.replace(/(rupees?|rs\.?|inr|usd|dollars?|\$|₹|€|£)/gi, " ").trim();

    // Try trailing/leading numeric price first
    const numMatch = cleaned.match(/(.*?)(\d+(?:\.\d+)?)(?!.*\d)/);
    if (numMatch && numMatch[2]) {
      const name = numMatch[1].replace(/[-:@]/g, " ").trim();
      const price = parseFloat(numMatch[2]);
      if (name && !isNaN(price)) {
        items.push({ name: titleCase(name), price });
        continue;
      }
    }

    // Fallback: words → number
    const wn = wordsToNumber(cleaned);
    if (wn !== null && wn > 0) {
      const name = cleaned
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => !(t in WORD_NUM))
        .join(" ")
        .trim();
      if (name) items.push({ name: titleCase(name), price: wn });
    }
  }
  return items;
}

function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\s+/g, " ").trim();
}
