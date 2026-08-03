import type { RGBA } from "./pixel-canvas";
import { hexToRgba, hslToRgb, rgbToHsl } from "./pixel-canvas";

export type Shading = { shadow: RGBA; base: RGBA; light: RGBA; highlight: RGBA };

function shadeFromBase(hex: string): Shading {
  const [r, g, b] = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  const [h, s] = rgbToHsl(r, g, b);
  const mk = (lightMul: number, satMul = 1): RGBA => {
    const [, , l] = rgbToHsl(r, g, b);
    const [rr, gg, bb] = hslToRgb(h, Math.min(1, s * satMul), Math.min(0.96, Math.max(0.03, l * lightMul)));
    return [rr, gg, bb, 255];
  };
  return { shadow: mk(0.62), base: hexToRgba(hex), light: mk(1.22, 0.92), highlight: mk(1.5, 0.7) };
}

// ---------- Skin tones (Schatten/Grundton/Licht/Glanz per SKIN_TONE_OPTIONS in hero-assets.ts) ----------
export const SKIN_SHADING: Record<"very-light" | "light" | "medium" | "dark" | "very-dark", Shading> = {
  "very-light": shadeFromBase("#F4D5B7"),
  light: shadeFromBase("#DFB177"),
  medium: shadeFromBase("#BA875A"),
  dark: shadeFromBase("#805435"),
  "very-dark": shadeFromBase("#523624"),
};

// ---------- Hair colors (matches HAIR_COLOR_OPTIONS in hero-assets.ts) ----------
export const HAIR_SHADING: Record<"black" | "darkbrown" | "brown" | "blonde" | "red" | "gray" | "silver" | "purple", Shading> = {
  black: shadeFromBase("#1E1A18"),
  darkbrown: shadeFromBase("#4A2E18"),
  brown: shadeFromBase("#88441D"),
  blonde: shadeFromBase("#D8B260"),
  red: shadeFromBase("#A33F21"),
  gray: shadeFromBase("#A3A3A8"),
  silver: shadeFromBase("#E7EBF0"),
  purple: shadeFromBase("#824EB2"),
};

// ---------- RoutineQuest brand palette (Schwarz-Lila-Gold) ----------
export const BRAND = {
  black: "#161320",
  purple: "#6D28D9",
  purpleLight: "#A855F7",
  gold: "#FACC15",
  goldDark: "#B4890A",
};

// ---------- Samurai legendary style ----------
// Schwarz, Dunkelrot, Lila und Gold; zentrale Rune/Kristall; kabuto-inspirierter Helm.
export const SAMURAI_PALETTE = {
  lacquerBlack: shadeFromBase("#1B1620"),
  deepRed: shadeFromBase("#7A1420"),
  violet: shadeFromBase("#5B2A87"),
  gold: shadeFromBase("#D4A93B"),
};
