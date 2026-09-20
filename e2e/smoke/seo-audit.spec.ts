import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";

const exec = promisify(execFile);

test("SEO audit rules and safety boundaries pass focused unit tests", async () => {
  const result = await exec(process.execPath, ["--test", "scripts/seo-audit.test.mjs"], {
    timeout: 30000,
    maxBuffer: 1024 * 1024,
  });
  expect(result.stderr).toBe("");
});

test("public SEO HTML contract produces a bounded report after the existing build", async ({
  baseURL,
}, testInfo) => {
  test.setTimeout(240000);
  expect(baseURL).toBeTruthy();
  const out = testInfo.outputPath("seo-audit");
  try {
    // The existing config starts a local production build and refuses production.
    // The separate audit CLI independently enforces the same safe target boundary.
    await exec(process.execPath, [
      "scripts/seo-audit.mjs", "--base-url", baseURL!, "--out", out, "--gate",
    ], { timeout: 210000, maxBuffer: 1024 * 1024 });
    const report = JSON.parse(await readFile(`${out}/seo-audit.json`, "utf8")) as {
      complete: boolean;
      pages: unknown[];
      errors: string[];
    };
    expect(report.complete).toBe(true);
    expect(report.pages).toHaveLength(15);
    expect(report.errors).toEqual([]);
  } finally {
    for (const [name, contentType] of [
      ["seo-audit.json", "application/json"],
      ["seo-audit.md", "text/markdown"],
    ]) {
      const path = `${out}/${name}`;
      const exists = await access(path).then(() => true, () => false);
      if (exists) await testInfo.attach(name, { path, contentType });
    }
  }
});
