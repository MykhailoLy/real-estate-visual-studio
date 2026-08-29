import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import test from "node:test";

const TEXT_EXTENSIONS = new Set([".ts", ".tsx", ".css", ".svg", ".json", ".md"]);

// Guard the shared PicchuSpot design-system surfaces, not customer-configurable
// Property Showcase branding, test fixtures, or transactional email markup.
// White-label/customer colors are valid product data and must remain allowed.
const SCAN_ROOTS = [
  "src/app/globals.css",
  "src/components/brand",
  "src/components/layout",
  "public/brand",
  "public/icons/favicon.svg",
  "public/manifest.webmanifest",
  "docs/BRAND-PALETTE.md",
];
const SELF = "src/lib/brand-palette.test.ts";

function filesFrom(path: string): string[] {
  if (extname(path)) return TEXT_EXTENSIONS.has(extname(path)) ? [path] : [];

  const files: string[] = [];
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) files.push(...filesFrom(child));
    else if (TEXT_EXTENSIONS.has(extname(entry.name))) files.push(child);
  }
  return files;
}

test("PicchuSpot brand tokens stay fixed", () => {
  const css = readFileSync("src/app/globals.css", "utf8").toLowerCase();

  const expected = [
    "--color-primary: #071a2b;",
    "--color-background: #f4efe8;",
    "--color-secondary: #c7a94e;",
    "--color-border: #ded3c6;",
  ];

  for (const token of expected) {
    assert.ok(css.includes(token), `Missing fixed brand token: ${token}`);
  }
});

test("legacy PicchuSpot colors do not return to shared brand surfaces", () => {
  const legacyColors = [
    "#" + "0B1F3A",
    "#" + "0b1f3a",
    "#" + "B88A44",
    "#" + "b88a44",
  ];

  const offenders: string[] = [];

  for (const root of SCAN_ROOTS) {
    for (const path of filesFrom(root)) {
      if (path === SELF) continue;
      const source = readFileSync(path, "utf8");
      if (legacyColors.some((color) => source.includes(color))) {
        offenders.push(path);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `Legacy shared brand colors found in: ${offenders.join(", ")}`,
  );
});
