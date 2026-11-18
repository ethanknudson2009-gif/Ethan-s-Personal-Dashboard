/**
 * Sorts a transaction into a spending category from its description, using
 * keyword lists (no AI). You can change any category on the Money page.
 */

export const CATEGORIES = [
  { name: "Food", emoji: "🍔", color: "#ff8a5b" },
  { name: "Gas", emoji: "⛽", color: "#ffb547" },
  { name: "Shopping", emoji: "🛍️", color: "#a78bfa" },
  { name: "Subscriptions", emoji: "🔁", color: "#5b8cff" },
  { name: "Fun", emoji: "🎮", color: "#f472b6" },
  { name: "Bills", emoji: "🧾", color: "#94a3b8" },
  { name: "Transport", emoji: "🚗", color: "#38bdf8" },
  { name: "Sent", emoji: "↗️", color: "#fb7185" },
  { name: "Paycheck", emoji: "💼", color: "#3ddc97" },
  { name: "Window washing", emoji: "🧽", color: "#2ee6c9" },
  { name: "Received", emoji: "↙️", color: "#34d399" },
  { name: "Transfers", emoji: "🔄", color: "#64748b" },
  { name: "Other", emoji: "•", color: "#56647f" },
] as const;

export type CategoryName = (typeof CATEGORIES)[number]["name"];

export function categoryInfo(name: string) {
  return CATEGORIES.find((c) => c.name === name) ?? CATEGORIES[CATEGORIES.length - 1];
}

const RULES: [CategoryName, RegExp][] = [
  ["Transfers", /\b(cash ?out|transfer|deposit to|withdraw|add(?:ed)? cash|standard deposit|instant deposit|bank)\b/],
  ["Paycheck", /\b(prmi|payroll|paycheck|direct deposit|salary|wages?)\b/],
  ["Window washing", /\b(window|windows|washing|wash)\b/],
  ["Food", /\b(doordash|uber ?eats|grubhub|mcdonald'?s?|chick-?fil-?a|chipotle|taco bell|wendy'?s|burger|pizza|subway|starbucks|dutch bros|coffee|cafe|restaurant|food|lunch|dinner|breakfast|snack|in-n-out|panda|sonic|raising cane'?s|domino'?s|grocer(?:y|ies)|safeway|fry'?s|walmart grocery|trader joe'?s|sprouts)\b/],
  ["Gas", /\b(gas|fuel|shell|chevron|circle k|quiktrip|qt|arco|exxon|mobil|valero|maverik|76)\b/],
  ["Transport", /\b(uber|lyft|parking|car wash|oil change|auto ?parts|autozone|tire|bus|light rail)\b/],
  ["Subscriptions", /\b(spotify|netflix|hulu|disney\+?|apple(?:\.com)?\/bill|apple music|icloud|youtube premium|amazon prime|xbox game pass|playstation plus|subscription)\b/],
  ["Shopping", /\b(amazon|target|walmart|costco|best buy|nike|shein|temu|mall|store|shop)\b/],
  ["Fun", /\b(movie|cinema|theater|harkins|amc|game|steam|playstation|xbox|nintendo|concert|tickets?|bowling)\b/],
  ["Bills", /\b(phone bill|verizon|t-?mobile|at&t|insurance|rent|electric|aps|srp|water bill|internet|cox)\b/],
];

/**
 * @param text the description, name and notes together
 * @param cents positive = money in, negative = money out
 */
export function categorize(text: string, cents: number): CategoryName {
  const t = text.toLowerCase();
  for (const [name, re] of RULES) {
    if (!re.test(t)) continue;
    // Only incoming money can be a paycheck or a window-washing payment.
    if ((name === "Paycheck" || name === "Window washing") && cents < 0) continue;
    return name;
  }
  if (/\b(sent|payment to|cash app payment)\b/.test(t) && cents < 0) return "Sent";
  if (cents > 0) return "Received";
  return "Other";
}
