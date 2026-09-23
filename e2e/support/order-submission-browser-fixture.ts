import { createServer } from "node:http";
import { createRequire } from "node:module";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

// Bundle the production client modules, React gate, SDK, and site CSS. The
// fixture only supplies a tiny form and observes fetch; it does not implement
// submission/recovery rules. API replies are controlled by the browser spec.
const require = createRequire(import.meta.url);
const { webpack } = require("next/dist/compiled/webpack/webpack.js") as {
  webpack: {
    (configuration: object, callback: (error: Error | null, stats?: {
      hasErrors(): boolean;
      toString(options: object): string;
    }) => void): void;
    DefinePlugin: new (definitions: Record<string, string>) => object;
  };
};
const root = process.cwd();
// Generated JavaScript stays outside the repository and its lint input.
const output = await mkdtemp(path.join(tmpdir(), "picchuspot-f3-browser-"));
await writeFile(path.join(output, "typescript-loader.cjs"), `
const ts = require(${JSON.stringify(require.resolve("typescript"))});
module.exports = function (source) {
  return ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
  }}).outputText;
};
`);
await writeFile(path.join(output, "entry.js"), `
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import Gate from "@/components/order/OrderSubmissionRecoveryGate";
import { submitOrder } from "@/lib/submit-order";

window.__submissionFixture = { atPost: [] };
const originalFetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  if (input === "/api/order" && init?.method === "POST") {
    // Observe synchronously at fetch invocation, before the request starts.
    window.__submissionFixture.atPost.push({
      body: init.body,
      record: JSON.parse(sessionStorage.getItem("picchuspot:order-submission:v1:photo-editing")),
    });
  }
  return originalFetch(input, init);
};

function Form() {
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const [jobTitle, setJobTitle] = useState("Synthetic recovery job");
  const [file, setFile] = useState(null);
  return React.createElement("main", { className: "mx-auto max-w-xl p-6" },
    React.createElement("h1", null, "Synthetic order fixture"),
    React.createElement("input", { "aria-label": "Job title", value: jobTitle, onChange: (event) => setJobTitle(event.target.value) }),
    React.createElement("input", { "aria-label": "Source image", type: "file", onChange: (event) => setFile(event.target.files?.[0] ?? null) }),
    React.createElement("button", {
      type: "button", disabled: busy,
      onClick: async () => {
        setBusy(true);
        const response = await submitOrder("photo-editing", [{ service: "photo-editing", notes: "Original synthetic request" }],
          [{ file }],
          { accepted: true, earlyPerformanceRequested: true, allowPortfolio: false },
          jobTitle);
        setResult(JSON.stringify(response));
        setBusy(false);
      },
    }, "Submit synthetic order"),
    React.createElement("output", { "data-testid": "submit-result" }, result),
  );
}

const app = location.pathname.startsWith("/dashboard/jobs/")
  ? React.createElement("h1", null, "Existing order fixture")
  : React.createElement(Gate, null, React.createElement(Form));
createRoot(document.getElementById("root")).render(app);
`);
await new Promise<void>((resolve, reject) => {
  webpack({
    mode: "development",
    devtool: false,
    target: "web",
    entry: path.join(output, "entry.js"),
    output: { path: output, filename: "bundle.js" },
    resolve: {
      extensions: [".ts", ".tsx", ".js"],
      alias: { "@": path.join(root, "src") },
      modules: [path.join(root, "node_modules")],
    },
    module: { rules: [{ test: /\.tsx?$/, exclude: /node_modules/, use: path.join(output, "typescript-loader.cjs") }] },
    plugins: [new webpack.DefinePlugin({
      "process.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify("http://127.0.0.1:3210/__supabase"),
      "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY": JSON.stringify("synthetic-local-fixture"),
    })],
  }, (error, stats) => {
    if (error || stats?.hasErrors()) reject(error ?? new Error(stats?.toString({ all: false, errors: true })));
    else resolve();
  });
});
const cssPath = path.join(root, "src/app/globals.css");
const css = await postcss([tailwind({ base: root })]).process(await readFile(cssPath, "utf8"), { from: cssPath });
const bundle = await readFile(path.join(output, "bundle.js"));
const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Isolated submission fixture</title><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>';
createServer((request, response) => {
  const pathname = new URL(request.url ?? "/", "http://127.0.0.1:3210").pathname;
  if (pathname === "/__fixture/health") {
    response.end("ready");
  } else if (pathname === "/bundle.js") {
    response.setHeader("content-type", "text/javascript");
    response.end(bundle);
  } else if (pathname === "/fixture.css") {
    response.setHeader("content-type", "text/css");
    response.end(css.css);
  } else if (pathname.startsWith("/api/") || pathname.startsWith("/__supabase/")) {
    // A missing Playwright fixture must fail closed, never proxy an API call.
    response.writeHead(501, { "content-type": "application/json" });
    response.end('{"error":"No synthetic API fixture installed"}');
  } else {
    response.setHeader("content-type", "text/html");
    response.end(html);
  }
}).listen(3210, "127.0.0.1");
