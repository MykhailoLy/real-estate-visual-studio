import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const SQL = readFileSync(
  "supabase/add-welcome-offer-redemptions.sql",
  "utf8",
);
const HOTFIX_SQL = readFileSync(
  "supabase/fix-welcome-offer-rpc-coalesce.sql",
  "utf8",
);
const RPC_NAME = "commit_order_submission_with_welcome_offer_v1";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

function normalizedStatements(pattern: RegExp, source = SQL): string[] {
  return Array.from(source.matchAll(pattern), ([statement]) =>
    statement.replace(/\s+/g, " ").trim(),
  );
}

function rpcDefinition(source: string): string {
  const definition = source.match(
    new RegExp(
      `CREATE OR REPLACE FUNCTION public\\.${RPC_NAME}\\([\\s\\S]*?\\n\\$\\$;`,
    ),
  )?.[0];
  assert.ok(definition, `missing ${RPC_NAME} definition`);
  return definition.replaceAll("\r\n", "\n");
}

test("Welcome Offer migration is additive, constrained, and browser-inaccessible", () => {
  assert.match(SQL, /CREATE TABLE IF NOT EXISTS public\.welcome_offer_redemptions/);
  assert.match(SQL, /UNIQUE \(\s*user_id,\s*benefit_key\s*\)/);
  assert.match(SQL, /benefit_key IN \([\s\S]*image-enhancement-free[\s\S]*day-to-dusk-free[\s\S]*virtual-staging-first-image-50/);
  assert.match(SQL, /REFERENCES public\.orders\(id\)[\s\S]*DEFERRABLE INITIALLY DEFERRED/);
  assert.match(SQL, /ENABLE ROW LEVEL SECURITY/);
  assert.match(SQL, /REVOKE ALL ON TABLE public\.welcome_offer_redemptions\s+FROM PUBLIC, anon, authenticated, service_role;/);
  assert.deepEqual(
    normalizedStatements(
      /\bGRANT\s+[^;]*?\s+ON\s+(?:TABLE\s+)?public\.welcome_offer_redemptions\s+TO\s+[^;]+;/gi,
    ),
    [
      "GRANT SELECT, INSERT, DELETE ON TABLE public.welcome_offer_redemptions TO service_role;",
    ],
  );
  assert.doesNotMatch(SQL, /GRANT [^;]+ ON (?:TABLE\s+)?public\.welcome_offer_redemptions[^;]*TO (?:PUBLIC|anon|authenticated)/);
  assert.doesNotMatch(SQL, /\b(?:DROP|TRUNCATE)\b/i);
  assert.doesNotMatch(SQL, /UPDATE public\.orders|INSERT INTO public\.welcome_offer_redemptions[\s\S]*SELECT[\s\S]*FROM public\.orders/);
});

test("versioned commit RPC couples redemption and order commit race-safely", () => {
  assert.match(SQL, /FUNCTION public\.commit_order_submission_with_welcome_offer_v1/);
  assert.match(SQL, /SECURITY INVOKER[\s\S]*SET search_path = ''/);
  assert.match(SQL, /FOR UPDATE/);
  assert.match(SQL, /ON CONFLICT \(user_id, benefit_key\) DO NOTHING/);
  assert.match(SQL, /v_inserted IS DISTINCT FROM pg_catalog\.cardinality\(v_snapshot_keys\)/);
  assert.match(SQL, /'welcome_offer_conflict'::TEXT/);
  assert.match(SQL, /DELETE FROM public\.order_submissions[\s\S]*status = 'processing'[\s\S]*lease_token IS NOT DISTINCT FROM p_lease_token/);
  assert.match(SQL, /FROM public\.commit_order_submission\(/);
  assert.match(SQL, /DELETE FROM public\.welcome_offer_redemptions[\s\S]*v_result_code NOT IN \('created', 'replayed'\)/);
  assert.match(SQL, /IF v_submission\.status = 'committed'[\s\S]*FROM public\.commit_order_submission\(/);
  assert.match(SQL, /REVOKE EXECUTE ON FUNCTION public\.commit_order_submission_with_welcome_offer_v1[\s\S]*FROM PUBLIC, anon, authenticated/);
  const rpcExecuteGrants = normalizedStatements(
    /\bGRANT\s+[^;]*?\s+ON\s+(?:FUNCTION|ROUTINE)\s+public\.commit_order_submission_with_welcome_offer_v1\([^;]*?\)\s+TO\s+[^;]+;/gi,
  );
  assert.equal(rpcExecuteGrants.length, 1);
  assert.match(rpcExecuteGrants[0], /^GRANT EXECUTE ON FUNCTION /);
  assert.match(rpcExecuteGrants[0], /\) TO service_role;$/);
  assert.doesNotMatch(
    rpcExecuteGrants[0],
    /\bTO\s+(?:PUBLIC|anon|authenticated)\b/i,
  );
});

test("canonical and hotfix Welcome Offer RPCs stay identical and use valid COALESCE", () => {
  for (const entry of readdirSync("supabase", { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".sql")) continue;
    const source = readFileSync(join("supabase", entry.name), "utf8");
    assert.doesNotMatch(
      source,
      /pg_catalog\.coalesce\s*\(/i,
      `${entry.name} must use SQL COALESCE syntax`,
    );
  }

  for (const source of [SQL, HOTFIX_SQL]) {
    assert.match(
      source,
      /SELECT COALESCE\(\s*pg_catalog\.array_agg\(/,
    );
    assert.match(
      rpcDefinition(source),
      /SECURITY INVOKER\s+SET search_path = ''/,
    );

    assert.deepEqual(
      normalizedStatements(
        new RegExp(
          `\\b(?:REVOKE|GRANT)\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.${RPC_NAME}\\([^;]*?\\)\\s+(?:FROM|TO)\\s+[^;]+;`,
          "gi",
        ),
        source,
      ),
      [
        `REVOKE EXECUTE ON FUNCTION public.${RPC_NAME}( UUID, UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, INTEGER, UUID, JSONB, TEXT[] ) FROM PUBLIC, anon, authenticated;`,
        `GRANT EXECUTE ON FUNCTION public.${RPC_NAME}( UUID, UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, INTEGER, UUID, JSONB, TEXT[] ) TO service_role;`,
      ],
    );
  }

  assert.equal(rpcDefinition(HOTFIX_SQL), rpcDefinition(SQL));
});

test("migration preserves the deployed commit RPC and performs no backfill", () => {
  assert.doesNotMatch(SQL, /CREATE OR REPLACE FUNCTION public\.commit_order_submission\s*\(/);
  assert.doesNotMatch(SQL, /ALTER FUNCTION public\.commit_order_submission/);
  assert.match(SQL, /Existing rows are not backfilled/);
});

test("drafts, uploads, and previews have no Welcome Offer redemption write path", () => {
  const appFiles = sourceFiles("src").filter((path) => !path.includes(".test."));
  const callers = appFiles
    .filter((path) =>
      readFileSync(path, "utf8").includes(
        '"commit_order_submission_with_welcome_offer_v1"',
      ),
    )
    .map((path) => path.replaceAll("\\", "/"));
  assert.deepEqual(callers, ["src/lib/orders/create-order-server.ts"]);

  for (const path of appFiles) {
    const appSource = readFileSync(path, "utf8");
    assert.doesNotMatch(
      appSource,
      /\.from\(["']welcome_offer_redemptions["']\)[\s\S]{0,200}\.insert\(/,
      `${path} must not write redemption rows outside the atomic commit RPC`,
    );
  }
});
