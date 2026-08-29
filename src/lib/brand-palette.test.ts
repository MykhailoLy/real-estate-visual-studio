import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import test from "node:test";

const TEXT_EXTENSIONS = new Set([".ts", ".tsx", ".css", ".svg", ".json", ".md"]);
const SCAN_ROOTS = ["src", "public", "docs"];
const SELF = "src/lib/brand-palette.test.ts";

function walk(root: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...walk(path));
    else if (TEXT_EXTENSIONS.has(extname(entry.name))) files.push(path);
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

test("legacy PicchuSpot navy and gold do not return", () => {
  const legacyColors = [
    "#" + "0B1F3A",
    "#" + "0b1f3a",
    "#" + "B88A44",
    "#" + "b88a44",
  ];

  const offenders: string[] = [];

  for (const root of SCAN_ROOTS) {
    for (const path of walk(root)) {
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
    `Legacy brand colors found in: ${offenders.join(", ")}`,
  );
});
