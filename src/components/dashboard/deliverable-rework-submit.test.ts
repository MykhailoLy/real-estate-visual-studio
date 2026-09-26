import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

// Execute the actual component handler and upload function, with state setters
// and HTTP at the boundary. No copy of the submission algorithm or auth bypass.
const path = "src/components/dashboard/DeliverableReviewActions.tsx";
const source = readFileSync(path, "utf8");
const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function functionSource(name: string) {
  let found = "";
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(found, `Production function ${name} exists`);
  return found;
}

function fixture(failure?: "upload-url" | "PUT" | "complete" | "finalize", files = 1) {
  const selected = Array.from({ length: files }, (_, i) => ({
    id: `selected-${i}`, file: new File(["synthetic"], `reference-${i}.png`, { type: "image/png" }),
  }));
  const state: Record<string, unknown> = {
    status: null, showForm: true, selectedFiles: selected, draft: "Please brighten the room.",
    comment: null, referenceFileCount: null,
  };
  const calls: { url: string; body?: Record<string, unknown> }[] = [];
  let active = false;
  const ctx: Record<string, unknown> = {
    deliverableId: "synthetic-deliverable", fileInputRef: { current: { value: "selected" } },
    console: { warn() {} },
    async fetch(url: string, init: RequestInit) {
      const body = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
      calls.push({ url, body });
      const reply = (value: unknown, status = 200) => Response.json(value, { status });
      if (url.endsWith("/review")) {
        const pending = Number(body?.reference_file_count ?? 0) > 0;
        active = !pending;
        return reply({ ok: true, review: { id: "synthetic-review", status: pending ? "pending_review" : "rework_requested", comment: state.draft } });
      }
      if (url.endsWith("/finalize")) {
        assert.equal(state.status, null, "No visible success before finalize response");
        assert.equal(state.showForm, true);
        if (failure === "finalize") return reply({ error: "Could not submit rework request." }, 409);
        active = true;
        return reply({ ok: true, review: { id: "synthetic-review", status: "rework_requested", comment: state.draft } });
      }
      if (failure && (url.endsWith(failure) || init.method === failure)) return reply({ error: "PRIVATE upstream detail" }, 500);
      if (url.endsWith("/upload-url")) return reply({ ok: true, signedUrl: "https://storage.invalid/synthetic", file: { id: "synthetic-file" } });
      return reply({ ok: true });
    },
  };
  for (const key of ["apiError", "uploadWarning", "uploadStatus", "loading", "status", "comment", "referenceFileCount", "showForm", "draft", "selectedFiles"]) {
    ctx[`set${key[0].toUpperCase()}${key.slice(1)}`] = (value: unknown) => { state[key] = value; };
  }
  const js = ts.transpileModule(`${functionSource("uploadReferenceFile")}\n${functionSource("submitRework")}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const run = new Function(...Object.keys(ctx), `${js}; return submitRework;`)(...Object.values(ctx)) as
    (text: string, items: typeof selected) => Promise<void>;
  return { state, calls, selected, active: () => active, retry: () => { failure = undefined; }, run: () => run(String(state.draft), selected) };
}

for (const failure of ["upload-url", "PUT", "complete"] as const) {
  test(`F7: ${failure} failure leaves no active rework and retains the form/files`, async () => {
    const f = fixture(failure);
    await f.run();
    assert.deepEqual({ active: f.active(), status: f.state.status, form: f.state.showForm, selected: f.state.selectedFiles },
      { active: false, status: null, form: true, selected: f.selected });
    assert.equal(f.calls.filter(call => call.url.endsWith("/finalize")).length, 0);
    assert.match(String(f.state.apiError), /rework request was not submitted/i);
    assert.equal(f.state.loading, null);
  });
}

test("F7: every selected file completes before one finalization and visible success", async () => {
  const f = fixture(undefined, 2);
  await f.run();
  assert.deepEqual(f.calls.map(call => call.url.split("/").at(-1)), ["review", "upload-url", "synthetic", "complete", "upload-url", "synthetic", "complete", "finalize"]);
  assert.equal(f.calls[0].body?.reference_file_count, 2);
  assert.equal(f.calls.at(-1)?.body?.expected_file_count, 2);
  for (const call of f.calls.filter(call => call.url.endsWith("upload-url"))) assert.equal(call.body?.submission_mode, "pending_rework");
  assert.equal(f.state.status, "rework_requested");
  assert.equal(f.state.showForm, false);
  assert.equal(f.state.referenceFileCount, 2);
  assert.deepEqual(f.state.selectedFiles, []);
});

test("F7: finalize failure also preserves selected files, comment and retryable form", async () => {
  const f = fixture("finalize");
  await f.run();
  assert.equal(f.state.status, null);
  assert.equal(f.active(), false);
  assert.equal(f.state.showForm, true);
  assert.deepEqual(f.state.selectedFiles, f.selected);
  assert.equal(f.state.draft, "Please brighten the room.");
  assert.equal(f.calls.filter(call => call.url.endsWith("finalize")).length, 1);
});

test("F7: text-only rework uses exactly the original review POST", async () => {
  const f = fixture(undefined, 0);
  await f.run();
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].body?.reference_file_count, 0);
  assert.equal(f.state.status, "rework_requested");
  assert.equal(f.state.showForm, false);
});

test("F7: failed attachment can be retried with the same comment/files and a fresh preparation", async () => {
  const f = fixture("complete", 2);
  await f.run();
  assert.equal(f.state.showForm, true); assert.deepEqual(f.state.selectedFiles, f.selected);
  f.retry(); await f.run();
  assert.equal(f.calls.filter(call => call.url.endsWith("/review")).length, 2);
  assert.equal(f.calls.filter(call => call.url.endsWith("/finalize")).length, 1);
  assert.equal(f.state.status, "rework_requested"); assert.equal(f.state.referenceFileCount, 2);
  assert.equal(f.state.showForm, false);
});
