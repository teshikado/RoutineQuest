import path from "node:path";
import fs from "node:fs";
import { createCanvas, saveCanvas, rowSilhouette, blendPixel, profile, type Canvas } from "./pixel-canvas";
import { SKIN_SHADING } from "./palettes";

/** Small closed-fist sprite drawn over a weapon's hilt (see GRIP_ZONES in hero-render-config.ts
 * and the "GRIP" layer in character-sprite.tsx) so an equipped weapon reads as actually held
 * instead of floating next to the body -- one per gender x skin tone, skin-matched, weapon-type
 * independent (the fist sits at roughly the same "hand hangs at the character's side" point for
 * every weapon, only the zone position shifts slightly per type). */

const OUT_ROOT = path.resolve(__dirname, "../../public/hero/hand-grips");
const GENDERS = ["male", "female"] as const;
const SKINS = ["very-light", "light", "medium", "dark", "very-dark"] as const;
const W = 44;
const H = 50;

function drawFist(gender: (typeof GENDERS)[number], skin: (typeof SKINS)[number]): Canvas {
  const c = createCanvas(W, H);
  const shading = SKIN_SHADING[skin];
  const scale = gender === "male" ? 1 : 0.88;
  const cx = Math.round(W / 2);

  const knuckleHalf = profile([[0, 4 * scale], [0.15, 9 * scale], [0.55, 10 * scale], [0.85, 8 * scale], [1, 3 * scale]]);
  rowSilhouette(c, 8, 30, cx, knuckleHalf, (t, dx) => {
    const edge = Math.abs(dx);
    if (edge > 0.82) return shading.shadow;
    if (edge > 0.4) return shading.base;
    return t < 0.35 ? shading.highlight : shading.light;
  });

  // wrist/cuff below the fist -- narrower, darker, reads as the sleeve edge the hand emerges from
  rowSilhouette(c, 36, 10, cx, profile([[0, 7 * scale], [1, 6 * scale]]), () => shading.shadow, true);

  // knuckle crease marks
  for (const dx of [-5, -1, 4]) {
    for (let dy = 0; dy < 3; dy++) blendPixel(c, cx + Math.round(dx * scale), 12 + dy, shading.shadow);
  }

  // thumb wrapping around toward the viewer
  rowSilhouette(c, 16, 14, cx - Math.round(9 * scale), profile([[0, 3], [0.6, 4], [1, 2]]), (t, dx) => (Math.abs(dx) > 0.6 ? shading.shadow : shading.base));

  return c;
}

async function main() {
  let written = 0;
  for (const gender of GENDERS) {
    const outDir = path.join(OUT_ROOT, gender);
    fs.mkdirSync(outDir, { recursive: true });
    for (const skin of SKINS) {
      const c = drawFist(gender, skin);
      await saveCanvas(c, path.join(outDir, `${skin}.png`));
      written++;
    }
  }
  console.log(`generate-hand-grips: wrote ${written} hand-grip images`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
