/**
 * Color themes for the design gallery (/gallery). Each theme is a full set of
 * the color tokens in globals.css; picking one swaps them for the whole app.
 * Our own palettes, named for the feel they give.
 */
export type Theme = {
  id: string;
  name: string;
  vibe: string;
  bg: string;
  surface: string;
  raised: string;
  line: string;
  ink: string;
  muted: string;
  faint: string;
  accent: string;
  accentInk: string;
  electric: string;
  light?: boolean;
};

export const THEMES: Theme[] = [
  { id: "neon-teal", name: "Neon Teal", vibe: "The original: dark navy, glowing teal", bg: "#070b14", surface: "#0f1625", raised: "#151e31", line: "#1f2b44", ink: "#e8eef9", muted: "#8494b0", faint: "#56647f", accent: "#2ee6c9", accentInk: "#04221d", electric: "#5b8cff" },
  { id: "cyber-pink", name: "Cyber Pink", vibe: "Night city, hot pink and violet", bg: "#0c0714", surface: "#160f22", raised: "#1f1530", line: "#2e2045", ink: "#f4eafd", muted: "#a690bf", faint: "#6c5a83", accent: "#ff3ea5", accentInk: "#2a0418", electric: "#8b5cf6" },
  { id: "matrix", name: "Terminal Green", vibe: "Hacker terminal, green on black", bg: "#040805", surface: "#0a120c", raised: "#101b12", line: "#1a2b1d", ink: "#dcf5e0", muted: "#7fa287", faint: "#4c6652", accent: "#39ff6a", accentInk: "#032110", electric: "#22d3ee" },
  { id: "ember", name: "Ember", vibe: "Warm dark with orange fire", bg: "#0e0907", surface: "#18110d", raised: "#211812", line: "#33241b", ink: "#f8ece4", muted: "#b39684", faint: "#7a6253", accent: "#ff7a2f", accentInk: "#2b1103", electric: "#ffc93c" },
  { id: "ice", name: "Arctic", vibe: "Cold blue steel, crisp", bg: "#060a10", surface: "#0d141e", raised: "#131d2b", line: "#1f2d40", ink: "#e9f3ff", muted: "#8aa2bf", faint: "#566a83", accent: "#5ac8ff", accentInk: "#022033", electric: "#a5b4fc" },
  { id: "royal", name: "Royal Violet", vibe: "Deep purple with gold sparks", bg: "#0a0714", surface: "#130e24", raised: "#1b1433", line: "#2b2149", ink: "#efeaff", muted: "#9d93c4", faint: "#655c8a", accent: "#b48cff", accentInk: "#1d0a3d", electric: "#ffcf5c" },
  { id: "synthwave", name: "Synthwave", vibe: "80s sunset: magenta and cyan", bg: "#0d0618", surface: "#170d28", raised: "#211338", line: "#33204f", ink: "#fbeaff", muted: "#b08fcf", faint: "#755a92", accent: "#00e5ff", accentInk: "#00222a", electric: "#ff4fd8" },
  { id: "carbon", name: "Carbon", vibe: "Pure black, white and one red", bg: "#050505", surface: "#0e0e0e", raised: "#161616", line: "#262626", ink: "#f2f2f2", muted: "#9a9a9a", faint: "#606060", accent: "#ff3b3b", accentInk: "#2a0303", electric: "#e5e5e5" },
  { id: "ocean", name: "Deep Ocean", vibe: "Navy water and seafoam", bg: "#03101a", surface: "#071a28", raised: "#0c2436", line: "#15344c", ink: "#e3f4ff", muted: "#7fa3bd", faint: "#4f6f86", accent: "#3cf0b4", accentInk: "#03261a", electric: "#38bdf8" },
  { id: "gold", name: "Black & Gold", vibe: "Luxury: black, gold, cream", bg: "#09080a", surface: "#131114", raised: "#1b181c", line: "#2c272c", ink: "#f6efe3", muted: "#a99d8b", faint: "#706656", accent: "#f2c14e", accentInk: "#2b1f02", electric: "#e7a86b" },
  { id: "forest", name: "Forest", vibe: "Calm greens, easy on the eyes", bg: "#07100b", surface: "#0d1a13", raised: "#13241b", line: "#1f3629", ink: "#e6f4ea", muted: "#89a895", faint: "#587061", accent: "#7ee081", accentInk: "#0a2b0c", electric: "#c7e36b" },
  { id: "blood-moon", name: "Blood Moon", vibe: "Dark crimson, intense", bg: "#0d0508", surface: "#180a0f", raised: "#221016", line: "#371a23", ink: "#fbe9ee", muted: "#b78b97", faint: "#7c5560", accent: "#ff4d6d", accentInk: "#2d0410", electric: "#ff9f6b" },
  { id: "lavender", name: "Lavender Night", vibe: "Soft purple and pink, chill", bg: "#0d0b14", surface: "#16131f", raised: "#1e1a2b", line: "#2e2840", ink: "#f1edfa", muted: "#a49cba", faint: "#6d6682", accent: "#c4a1ff", accentInk: "#220d43", electric: "#f9a8d4" },
  { id: "volt", name: "Volt", vibe: "Black with electric yellow", bg: "#08080a", surface: "#111115", raised: "#18181e", line: "#26262f", ink: "#f4f4f6", muted: "#9b9bab", faint: "#61616e", accent: "#e8ff3a", accentInk: "#232a00", electric: "#3affc4" },
  { id: "slate", name: "Slate", vibe: "Quiet gray-blue, very clean", bg: "#0b0d11", surface: "#13161c", raised: "#1a1e26", line: "#282d38", ink: "#e7eaf0", muted: "#929aa9", faint: "#5d6472", accent: "#7aa2ff", accentInk: "#0a1a3d", electric: "#9ae6b4" },
  { id: "aurora", name: "Aurora", vibe: "Northern lights: green into purple", bg: "#050a12", surface: "#0b1420", raised: "#111c2c", line: "#1c2b40", ink: "#e8f6f4", muted: "#86a3a8", faint: "#556f75", accent: "#4dffb8", accentInk: "#032a1c", electric: "#b18cff" },
  { id: "coffee", name: "Espresso", vibe: "Warm browns and cream", bg: "#0e0a08", surface: "#18120e", raised: "#211914", line: "#33271f", ink: "#f4ebe2", muted: "#ad9a8a", faint: "#76665a", accent: "#e3a96b", accentInk: "#2b1806", electric: "#9fd3a8" },
  { id: "miami", name: "Miami", vibe: "Teal water, pink neon", bg: "#071014", surface: "#0d1a20", raised: "#13232b", line: "#1e3540", ink: "#eaf8fb", muted: "#86a8b2", faint: "#557580", accent: "#ff6fb5", accentInk: "#300419", electric: "#2ee6d6" },
  { id: "paper", name: "Paper (light)", vibe: "Bright and clean, for daytime", bg: "#f4f6fa", surface: "#ffffff", raised: "#eef1f6", line: "#d9dfe9", ink: "#0f1726", muted: "#5b6577", faint: "#8b94a5", accent: "#0fae96", accentInk: "#ffffff", electric: "#3b6cf6", light: true },
  { id: "sunrise", name: "Sunrise (light)", vibe: "Warm cream with coral", bg: "#fbf6f1", surface: "#ffffff", raised: "#f5ede5", line: "#eadfd4", ink: "#2a1c14", muted: "#7a685c", faint: "#a89587", accent: "#f2613f", accentInk: "#ffffff", electric: "#7c5cff", light: true },
];

export const DEFAULT_THEME = THEMES[0];

export function themeById(id: string | null | undefined): Theme {
  return THEMES.find((t) => t.id === id) ?? DEFAULT_THEME;
}

/** The CSS custom properties for a theme (applied on :root). */
export function themeVars(t: Theme): Record<string, string> {
  return {
    "--color-bg": t.bg,
    "--color-surface": t.surface,
    "--color-raised": t.raised,
    "--color-line": t.line,
    "--color-ink": t.ink,
    "--color-muted": t.muted,
    "--color-faint": t.faint,
    "--color-accent": t.accent,
    "--color-accent-ink": t.accentInk,
    "--color-electric": t.electric,
  };
}

/** A :root { … } rule for the server to put in the page, so there's no flash of the old colors. */
export function themeCss(t: Theme): string {
  const vars = Object.entries(themeVars(t))
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
  return `:root{${vars}}${t.light ? "html{color-scheme:light}input,select,textarea{color-scheme:light}" : ""}`;
}
