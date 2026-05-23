const DEVANAGARI_DIGITS: Record<string, string> = {
  "०": "0",
  "१": "1",
  "२": "2",
  "३": "3",
  "४": "4",
  "५": "5",
  "६": "6",
  "७": "7",
  "८": "8",
  "९": "9",
};

const HINDI_DIRECT_NUMBERS: Record<string, number> = {
  "पचपन": 55,
  "पचहत्तर": 75,
  "पिच्यासी": 85,
  "उनासी": 79,
  "नवासी": 89,
  "इक्यासी": 81,
  "बयासी": 82,
  "पचास": 50,
  "साठ": 60,
  "सत्तर": 70,
  "अस्सी": 80,
  "नब्बे": 90,
};

const HINDI_UNITS: Record<string, number> = {
  शून्य: 0,
  एक: 1,
  दो: 2,
  तीन: 3,
  चार: 4,
  पांच: 5,
  पाँच: 5,
  छह: 6,
  छः: 6,
  सात: 7,
  आठ: 8,
  नौ: 9,
  दस: 10,
  ग्यारह: 11,
  बारह: 12,
  तेरह: 13,
  चौदह: 14,
  पंद्रह: 15,
  पन्द्रह: 15,
  सोलह: 16,
  सत्रह: 17,
  अठारह: 18,
  अट्ठारह: 18,
  उन्नीस: 19,
};

const HINDI_TENS: Record<string, number> = {
  बीस: 20,
  तीस: 30,
  चालीस: 40,
  पचास: 50,
  साठ: 60,
  सत्तर: 70,
  अस्सी: 80,
  नब्बे: 90,
};

const HINDI_SCALES: Record<string, number> = {
  सौ: 100,
  हज़ार: 1000,
  हजार: 1000,
};

const HINDI_FRACTIONS: Record<string, number> = {
  ढाई: 2.5,
  साढ़े: 0.5,
  साढे: 0.5,
  ढै: 2.5,
};

const ENGLISH_UNITS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};

const ENGLISH_TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const ENGLISH_SCALES: Record<string, number> = {
  hundred: 100,
  thousand: 1000,
  million: 1000000,
};

export type ParsedProductPrice = {
  productName: string;
  price: number | null;
};

function normalizeHindiDigits(text: string): string {
  return text.replace(/[०१२३४५६७८९]/g, (digit) => DEVANAGARI_DIGITS[digit] ?? digit);
}

function normalizeText(text: string): string {
  return normalizeHindiDigits(text)
    .replace(/[,]/g, " ")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function parseIntegerLiteral(text: string): number | null {
  const digits = normalizeHindiDigits(text).match(/\d+/g);
  if (!digits) return null;
  return Number(digits.join(""));
}

function parseEnglishNumberWords(text: string): number | null {
  const normalized = normalizeText(text)
    .replace(/-/g, " ")
    .replace(/\band\b/g, " ")
    .trim();
  if (!normalized) return null;

  const tokens = normalized.split(/\s+/).filter(Boolean);
  let total = 0;
  let current = 0;
  let found = false;

  for (const token of tokens) {
    if (ENGLISH_SCALES[token] !== undefined) {
      const scale = ENGLISH_SCALES[token];
      if (current === 0) current = 1;
      current *= scale;
      total += current;
      current = 0;
      found = true;
      continue;
    }

    if (ENGLISH_TENS[token] !== undefined) {
      current += ENGLISH_TENS[token];
      found = true;
      continue;
    }

    if (ENGLISH_UNITS[token] !== undefined) {
      current += ENGLISH_UNITS[token];
      found = true;
      continue;
    }

    if (/^\d+$/.test(token)) {
      current += Number(token);
      found = true;
      continue;
    }
  }

  if (!found) return null;
  return total + current;
}

function parseHindiNumberWords(text: string): number | null {
  const normalized = normalizeText(text).replace(/-/g, " ").trim();
  if (!normalized) return null;

  if (HINDI_DIRECT_NUMBERS[normalized] !== undefined) {
    return HINDI_DIRECT_NUMBERS[normalized];
  }

  const tokens = normalized.split(/\s+/).filter(Boolean);
  let total = 0;
  let current = 0;
  let found = false;

  for (const token of tokens) {
    if (HINDI_FRACTIONS[token] !== undefined) {
      current += HINDI_FRACTIONS[token];
      found = true;
      continue;
    }

    if (HINDI_DIRECT_NUMBERS[token] !== undefined) {
      current += HINDI_DIRECT_NUMBERS[token];
      found = true;
      continue;
    }

    if (HINDI_UNITS[token] !== undefined) {
      current += HINDI_UNITS[token];
      found = true;
      continue;
    }

    if (HINDI_TENS[token] !== undefined) {
      current += HINDI_TENS[token];
      found = true;
      continue;
    }

    if (HINDI_SCALES[token] !== undefined) {
      const scale = HINDI_SCALES[token];
      if (current === 0) current = 1;
      current *= scale;
      total += current;
      current = 0;
      found = true;
      continue;
    }

    if (/^\d+$/.test(token)) {
      current += Number(token);
      found = true;
      continue;
    }
  }

  if (!found) return null;
  return total + current;
}

export function normalizePrice(value: string): number | null {
  if (!value || !value.trim()) return null;

  const directDigits = parseIntegerLiteral(value);
  if (directDigits !== null) return directDigits;

  const english = parseEnglishNumberWords(value);
  if (english !== null) return english;

  const hindi = parseHindiNumberWords(value);
  if (hindi !== null) return Math.round(hindi);

  return null;
}

export function parseProductNameAndPrice(input: string): ParsedProductPrice {
  const originalTokens = input.trim().split(/\s+/).filter(Boolean);
  const tokenCount = originalTokens.length;

  for (let suffixLength = tokenCount; suffixLength > 0; suffixLength -= 1) {
    const suffix = originalTokens.slice(tokenCount - suffixLength).join(" ");
    const price = normalizePrice(suffix);
    if (price !== null) {
      return {
        productName: originalTokens.slice(0, tokenCount - suffixLength).join(" ").trim(),
        price,
      };
    }
  }

  return {
    productName: input.trim(),
    price: null,
  };
}
