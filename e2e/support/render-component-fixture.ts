import { execFileSync } from "node:child_process";

/** Render real React components without Playwright's component-test JSX descriptors. */
export function renderComponentFixture(script: string, input: unknown): string {
  return execFileSync(process.execPath, ["--input-type=module", "-e", `
  import { registerHooks } from "node:module";
  import { readFileSync, existsSync } from "node:fs";
  import { pathToFileURL } from "node:url";
  import ts from "typescript";
  import { createElement } from "react";
  import { renderToStaticMarkup } from "react-dom/server";
  const root = pathToFileURL(process.cwd() + "/");
  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === "next/image") {
        const imageUrl = nextResolve("next/image.js", context).url;
        return { url: "data:text/javascript," + encodeURIComponent("import image from '" + imageUrl + "'; export default image.default;"), shortCircuit: true };
      }
      if (specifier.startsWith("@/") || specifier.startsWith(".")) {
        const base = specifier.startsWith("@/")
          ? new URL("src/" + specifier.slice(2), root) : new URL(specifier, context.parentURL);
        for (const extension of ["", ".ts", ".tsx", "/index.ts"]) {
          const url = new URL(base.href + extension);
          if (/\\.tsx?$/.test(url.pathname) && existsSync(url)) return { url: url.href, shortCircuit: true };
        }
      }
      if (specifier === "next/link" || specifier === "next/navigation") {
        return nextResolve(specifier + ".js", context);
      }
      return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      if (/\\.tsx?$/.test(url)) return { format: "module", shortCircuit: true,
        source: ts.transpileModule(readFileSync(new URL(url), "utf8"), { compilerOptions: {
          module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
        } }).outputText,
      };
      return nextLoad(url, context);
    },
  });

  ${script}
  `, JSON.stringify(input)], { encoding: "utf8", timeout: 15000 });
}
