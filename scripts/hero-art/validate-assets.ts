import path from "node:path";
import fs from "node:fs";
import sharp from "sharp";
import { BUILD_KEYS } from "./generate-bodies";
import { HAIR_STYLE_KEYS } from "./generate-hairstyles";

const ARMOR_SET_KEYS = [
  "iron-guard", "wander-hunter", "north-fur",
  "sapphire-guard", "arcane-keeper", "night-runner",
  "void-guard", "rune-lord", "shadow-blade",
  "sky-warden", "sun-king", "star-breaker", "samurai",
] as const;
const ARMOR_SLOTS = ["helmet", "chest", "pants", "shoes"] as const;

/** Verifies every asset this generator suite is responsible for: file exists, is a real PNG,
 * has an alpha channel, isn't empty/degenerate, and (for hairstyles/bodies, which must all
 * share one fixed per-gender canvas) has the expected dimensions. Run after any regeneration --
 * `npx tsx scripts/hero-art/validate-assets.ts`. */

const PUB = path.resolve(__dirname, "../../public/hero");
const GENDERS = ["male", "female"] as const;
const SKINS = ["very-light", "light", "medium", "dark", "very-dark"] as const;
const COLORS = ["black", "darkbrown", "brown", "blonde", "red", "gray", "silver", "purple"] as const;
const NATIVE_SIZE: Record<string, { width: number; height: number }> = {
  male: { width: 171, height: 315 },
  female: { width: 163, height: 316 },
};

type Check = { file: string; ok: boolean; reason?: string };

async function check(file: string, expectDims?: { width: number; height: number }): Promise<Check> {
  if (!fs.existsSync(file)) return { file, ok: false, reason: "missing" };
  const stat = fs.statSync(file);
  if (stat.size < 100) return { file, ok: false, reason: `too small (${stat.size} bytes)` };
  try {
    const meta = await sharp(file).metadata();
    if (meta.format !== "png") return { file, ok: false, reason: `not png (${meta.format})` };
    if (!meta.hasAlpha) return { file, ok: false, reason: "no alpha channel" };
    if (expectDims && (meta.width !== expectDims.width || meta.height !== expectDims.height)) {
      return { file, ok: false, reason: `dims ${meta.width}x${meta.height} != expected ${expectDims.width}x${expectDims.height}` };
    }
    return { file, ok: true };
  } catch (err) {
    return { file, ok: false, reason: String(err) };
  }
}

async function main() {
  const checks: Promise<Check>[] = [];

  for (const gender of GENDERS) {
    for (const build of BUILD_KEYS) {
      for (const skin of SKINS) {
        checks.push(check(path.join(PUB, "characters", gender, "body", build, `${skin}.png`), NATIVE_SIZE[gender]));
      }
    }
    for (const style of HAIR_STYLE_KEYS) {
      for (const color of COLORS) {
        checks.push(check(path.join(PUB, "hairstyles", style, gender, `${color}.png`), NATIVE_SIZE[gender]));
      }
    }
  }
  for (const set of ARMOR_SET_KEYS) {
    for (const slot of ARMOR_SLOTS) {
      checks.push(check(path.join(PUB, "armor-sets", set, `${slot}-icon.png`)));
    }
    for (const gender of GENDERS) {
      // HELMET overlay is build-independent (see generate-armor-overlays.ts).
      checks.push(check(path.join(PUB, "armor-sets", set, "overlay", "helmet", `${gender}.png`), NATIVE_SIZE[gender]));
      for (const slot of ["chest", "pants", "shoes"] as const) {
        for (const build of BUILD_KEYS) {
          checks.push(check(path.join(PUB, "armor-sets", set, "overlay", slot, gender, `${build}.png`), NATIVE_SIZE[gender]));
        }
      }
    }
  }
  for (const gender of GENDERS) {
    for (const skin of SKINS) {
      checks.push(check(path.join(PUB, "hand-grips", gender, `${skin}.png`)));
    }
  }
  for (const species of ["wolf", "snake", "lion", "tiger", "bear", "eagle", "panther"]) {
    for (let stage = 1; stage <= 4; stage++) {
      checks.push(check(path.join(PUB, "pets", species, `stage-${stage}.png`)));
    }
  }

  const results = await Promise.all(checks);
  const failed = results.filter((r) => !r.ok);
  console.log(`validate-assets: ${results.length} checked, ${results.length - failed.length} ok, ${failed.length} failed`);
  for (const f of failed) console.log(`  FAIL ${path.relative(PUB, f.file)}: ${f.reason}`);
  if (failed.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
