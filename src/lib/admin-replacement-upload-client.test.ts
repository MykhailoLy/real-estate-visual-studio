import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

// Execute the real component handlers, with HTTP/state only at the boundary.
// This captured F8 RED before either production component was changed.
const components = ["AdminOrderImageCard", "AdminDeliverableUpload"] as const;
type Row = Record<string, unknown>;
function fixture(component: typeof components[number], replacement = true, failure = "finalize") {
  const path = `src/components/admin/${component}.tsx`;
  const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let handler = "";
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "handleFileChange") handler = node.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.ok(handler);
  const file = new File(["synthetic"], "replacement.png", { type: "image/png" });
  const calls: { url: string; method: string; body?: Row }[] = [];
  const rows: Row[] = [], events: string[] = [];
  const state: Row = { deliverables: [], reviewList: [{ id: "review", status: "rework_requested" }] };
  let prepared = 0, lost = false;
  const fakeFetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input), method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) as Row : undefined;
    calls.push({ url, method, body });
    if (url.endsWith("/upload-url")) return Response.json({ signedUrl: "https://storage.invalid/upload", path: "synthetic/path" });
    if (url.endsWith("/replacement") && method === "POST") {
      prepared++;
      return Response.json({ ok: true, replacementDeliverableId: `candidate-${prepared}`, signedUrl: "https://storage.invalid/upload" });
    }
    if (method === "PUT") return Response.json({}, { status: failure === "PUT" ? 500 : 200 });
    if (url.endsWith("/deliverables") && method === "POST") {
      const row = { id: `generic-${rows.length}`, filename: file.name }; rows.push(row);
      return Response.json({ deliverable: row });
    }
    assert.equal(method, "PATCH");
    if (failure === "finalize") return Response.json({ error: "Synthetic failure" }, { status: 409 });
    assert.equal(state.uploadSuccess ?? state.successMsg ?? null, null, "No success before commit response");
    let row = rows.find(row => row.id === body?.replacementDeliverableId);
    if (!row) { row = { id: body?.replacementDeliverableId, filename: file.name, item_index: 0 }; rows.push(row); events.push("ready"); }
    if (failure === "response-lost" && !lost) { lost = true; throw new TypeError("Connection lost after commit"); }
    if (failure === "always-unknown") throw new TypeError("Connection lost");
    return Response.json({ ok: true, status: "rework_delivered", replacementDeliverableId: row.id, deliverable: row });
  };
  const ctx: Row = {
    orderId: "order", imageNumber: 1, itemIndex: 0,
    replacementReview: replacement ? { id: "review", itemIndex: 0 } : null,
    ADMIN_DELIVERABLE_MAX_BYTES: 200 * 1024 * 1024, ADMIN_DELIVERABLE_MAX_MB: 200,
    isMimeAccepted: () => true, getItemIndex: () => 0, onDeliverableAdded: () => {}, fetch: fakeFetch,
    async uploadAdminReplacement(...args: unknown[]) {
      const helper = await import(new URL("./admin-replacement-upload-client.ts", import.meta.url).href);
      const original = globalThis.fetch;
      globalThis.fetch = fakeFetch;
      try { return await helper.uploadAdminReplacement(...args); } finally { globalThis.fetch = original; }
    },
  };
  for (const key of ["uploadError", "errorMsg", "uploadSuccess", "successMsg", "uploading", "uploadProgress", "progress", "deliverables", "reviewList"]) {
    ctx[`set${key[0].toUpperCase()}${key.slice(1)}`] = (value: unknown) => {
      state[key] = typeof value === "function" ? value(state[key]) : value;
    };
  }
  const js = ts.transpileModule(handler, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const run = new Function(...Object.keys(ctx), `${js}; return handleFileChange;`)(...Object.values(ctx)) as (event: unknown) => Promise<void>;
  return { state, rows, calls, events, run: () => run({ target: { files: [file], value: "selected" } }) };
}

for (const component of components) {
  test(`F8 ${component}: failed replacement finalize and retry leave no registered deliverable`, async () => {
    const f = fixture(component);
    await f.run(); await f.run();
    assert.equal(f.rows.length, 0, "No orphan DB deliverable after two failed attempts");
    assert.equal(f.calls.some(call => call.url.endsWith("/deliverables")), false, "Replacement never uses generic registration");
    assert.equal(f.state.uploadSuccess ?? f.state.successMsg ?? null, null);
    assert.match(String(f.state.uploadError ?? f.state.errorMsg), /could not be finalized.*not updated/i);
  });

  test(`F8 ${component}: lost commit response reconciles the same candidate without another upload`, async () => {
    const f = fixture(component, true, "response-lost"); await f.run();
    assert.equal(f.rows.length, 1); assert.equal(f.events.length, 1);
    assert.deepEqual(f.calls.map(call => call.method), ["POST", "PUT", "PATCH", "PATCH"]);
    const patches = f.calls.filter(call => call.method === "PATCH");
    assert.deepEqual(patches[0].body, patches[1].body);
    assert.equal(patches[0].body?.mode, "atomic_upload");
    assert.equal(patches[0].body?.replacementDeliverableId, "candidate-1");
    assert.match(String(f.state.uploadSuccess ?? f.state.successMsg), /uploaded as.*replacement/);
    assert.equal((f.state.deliverables as Row[])[0].id, "candidate-1");
    if (component === "AdminOrderImageCard") assert.deepEqual(f.state.reviewList,
      [{ id: "review", status: "rework_delivered", replacement_deliverable_id: "candidate-1" }]);
  });

  test(`F8 ${component}: PUT failure never finalizes or registers`, async () => {
    const f = fixture(component, true, "PUT"); await f.run();
    assert.deepEqual(f.calls.map(call => call.method), ["POST", "PUT"]);
    assert.equal(f.rows.length, 0); assert.equal(f.events.length, 0);
    assert.equal((f.state.deliverables as Row[]).length, 0);
  });

  test(`F8 ${component}: unresolved transport outcome is bounded and does not claim rollback`, async () => {
    const f = fixture(component, true, "always-unknown"); await f.run();
    assert.deepEqual(f.calls.map(call => call.method), ["POST", "PUT", "PATCH", "PATCH"]);
    assert.equal(f.rows.length, 1); assert.equal(f.events.length, 1);
    assert.match(String(f.state.uploadError ?? f.state.errorMsg), /could not confirm/i);
    assert.equal((f.state.deliverables as Row[]).length, 0);
  });

  test(`F8 ${component}: ordinary upload retains signed URL, PUT, generic registration`, async () => {
    const f = fixture(component, false, ""); await f.run();
    assert.deepEqual(f.calls.map(call => call.method), ["POST", "PUT", "POST"]);
    assert.equal(f.calls[0].url, "/api/admin/orders/order/deliverables/upload-url");
    assert.equal(f.calls[2].url, "/api/admin/orders/order/deliverables");
    assert.equal(f.calls[2].body?.item_index, 0);
    assert.equal(f.rows.length, 1);
  });
}
