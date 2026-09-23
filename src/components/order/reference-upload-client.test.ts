import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import * as nodeModule from "node:module";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JsxEmit, ModuleKind, ScriptTarget, transpileModule } from "typescript";
import {
  appendReferenceFiles,
  type ReferenceFileValue,
} from "../../lib/reference-files.ts";
import {
  completeDraftReferenceFile,
  listDraftReferenceFiles,
  prepareDraftReferenceFile,
} from "../../lib/order-drafts/draft-reference-files-client.ts";
import type { DraftReferenceFileSummary } from "../../lib/order-drafts/draft-reference-files.ts";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

interface HookContext {
  parentURL?: string;
  format?: string;
}

interface ResolveHookResult {
  url: string;
  shortCircuit?: boolean;
}

interface LoadHookResult {
  format: string;
  source?: string | Uint8Array;
  shortCircuit?: boolean;
}

type ResolveNext = (
  specifier: string,
  context: HookContext,
) => ResolveHookResult;

type LoadNext = (url: string, context: HookContext) => LoadHookResult;

const registerHooks = Reflect.get(nodeModule, "registerHooks") as (hooks: {
  resolve(
    specifier: string,
    context: HookContext,
    nextResolve: ResolveNext,
  ): ResolveHookResult;
  load(url: string, context: HookContext, nextLoad: LoadNext): LoadHookResult;
}) => void;

registerHooks({
  resolve(specifier, context, nextResolve) {
    let localPath: string | null = null;
    if (specifier === "next/image") {
      localPath = join(ROOT_DIR, "node_modules", "next", "image.js");
    } else if (specifier.startsWith("@/")) {
      localPath = join(ROOT_DIR, "src", specifier.slice(2));
    } else if (
      specifier.startsWith(".") &&
      context.parentURL?.startsWith("file:")
    ) {
      localPath = resolve(dirname(fileURLToPath(context.parentURL)), specifier);
    }

    if (localPath) {
      const candidates = [
        localPath,
        `${localPath}.ts`,
        `${localPath}.tsx`,
        join(localPath, "index.ts"),
        join(localPath, "index.tsx"),
      ];
      const match = candidates.find(
        (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
      );
      if (match) {
        return { url: pathToFileURL(match).href, shortCircuit: true };
      }
    }

    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith("file:") && url.endsWith(".tsx")) {
      const source = readFileSync(fileURLToPath(url), "utf8");
      return {
        format: "module",
        shortCircuit: true,
        source: transpileModule(source, {
          compilerOptions: {
            jsx: JsxEmit.ReactJSX,
            module: ModuleKind.ESNext,
            target: ScriptTarget.ES2022,
          },
        }).outputText,
      };
    }

    return nextLoad(url, context);
  },
});

const { default: ReferenceFilesUploader } = await import(
  "./ReferenceFilesUploader.tsx"
);
const { default: StagingItemCard, emptyStagingItem } = await import(
  "./virtual-staging/StagingItemCard.tsx"
);
const { default: RenovationItemCard, emptyRenovationItem } = await import(
  "./virtual-renovation/RenovationItemCard.tsx"
);

function uploadedReference(
  id: string,
  filename = "reference.png",
  overrides: Partial<ReferenceFileValue> = {},
): ReferenceFileValue {
  return {
    id,
    draftFileId: id,
    file: null,
    filename,
    fileSize: 1024,
    mimeType: "image/png",
    lastModified: null,
    storagePath: null,
    previewUrl: `https://storage.example/object/sign/order-files/${id}.png?token=fixture`,
    ...overrides,
  };
}

function renderUploader(references: ReferenceFileValue[]): string {
  return renderToStaticMarkup(
    createElement(ReferenceFilesUploader, {
      files: references,
      onChange: () => undefined,
    }),
  );
}

test("successful reference completion renders a signed preview without crashing", () => {
  const selected = appendReferenceFiles([], [
    new File([Uint8Array.of(0x89, 0x50, 0x4e, 0x47)], "reference.png", {
      type: "image/png",
      lastModified: 1,
    }),
  ]).accepted[0];
  const localMarkup = renderUploader([selected]);
  assert.match(localMarkup, /blob:/);

  const completed = uploadedReference(selected.id);
  const completedMarkup = renderUploader([completed]);
  assert.match(completedMarkup, /1 of 10 files/);
  assert.match(completedMarkup, /storage\.example\/object\/sign\/order-files/);
  assert.doesNotMatch(completedMarkup, /data-nimg=/);
});

test("two completed references appear immediately with independent removal identities", () => {
  const first = uploadedReference("first-reference-id", "first.png");
  const second = uploadedReference("second-reference-id", "second.png");

  const markup = renderUploader([first, second]);
  assert.match(markup, /2 of 10 files/);
  assert.match(markup, /data-reference-remove="first-reference-id"/);
  assert.match(markup, /data-reference-remove="second-reference-id"/);
});

test("duplicate filenames render once per stable server reference ID", () => {
  const first = uploadedReference("same-name-first-id", "same.png");
  const second = uploadedReference("same-name-second-id", "same.png");

  const markup = renderUploader([first, second]);
  assert.match(markup, /2 of 10 files/);
  assert.match(markup, /data-reference-remove="same-name-first-id"/);
  assert.match(markup, /data-reference-remove="same-name-second-id"/);
  assert.equal((markup.match(/aria-label="Remove reference same\.png"/g) ?? []).length, 2);
});

test("rehydrated card hides the legacy mirror while retaining inline invalid_upload errors", () => {
  const reference = uploadedReference("normalized-reference-id", "saved.png");
  const error =
    "The file contents do not match its file type. Please upload a valid JPG, PNG, WebP, or PDF file.";
  const markup = renderToStaticMarkup(
    createElement(StagingItemCard, {
      index: 0,
      totalItems: 1,
      data: {
        ...emptyStagingItem(),
        referenceFiles: [reference],
      },
      defaultFurnitureStyle: "",
      exampleMediaByKey: {},
      onChange: () => undefined,
      onRemove: () => undefined,
      canRemove: false,
      uploadedReferenceFile: {
        id: "legacy-mirror-id",
        itemClientId: "fixture-item-id",
        itemIndex: 0,
        kind: "reference",
        originalFilename: reference.filename,
        fileSize: reference.fileSize,
        mimeType: reference.mimeType,
        uploadStatus: "uploaded",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        previewUrl: reference.previewUrl,
      },
      referenceOperationErrorText: error,
    }),
  );

  assert.match(markup, /1 of 10 files/);
  assert.match(markup, /data-reference-remove="normalized-reference-id"/);
  assert.doesNotMatch(markup, /data-reference-remove="legacy-mirror-id"/);
  assert.doesNotMatch(markup, /fake-upload-test\.jpg/);
  assert.ok(markup.includes(error));
  assert.match(markup, /role="alert"/);
});

for (const service of ["Virtual Staging", "Virtual Renovation"] as const) {
  test(`${service}: prepared, completed and restored canonical references render in the actual item card`, async (context) => {
    const id = "33333333-3333-4333-8333-333333333333";
    const itemClientId = "22222222-2222-4222-8222-222222222222";
    const draftId = "11111111-1111-4111-8111-111111111111";
    const completed: DraftReferenceFileSummary = {
      ...uploadedReference(id, "saved.png"),
      id, draftFileId: id, itemClientId, position: 0, file: null, storagePath: null,
    };
    const prepared = { ...completed, previewUrl: null };
    let request = 0;
    context.mock.method(globalThis, "fetch", async () => {
      request += 1;
      if (request === 1) return Response.json({ data: {
        reference: prepared,
        upload: { bucket: "order-files", path: "draft/fixture", token: "fixture", signedUrl: "https://storage.example/upload" },
      } });
      if (request === 2) return Response.json({ data: completed });
      return Response.json({ data: [completed] });
    });
    const preparedResult = await prepareDraftReferenceFile(draftId, {
      itemClientId, referenceId: id, position: 0, filename: "saved.png", fileSize: 1024, mimeType: "image/png",
    });
    const completedResult = await completeDraftReferenceFile(draftId, id);
    const restoredResult = await listDraftReferenceFiles(draftId);
    assert.ok(preparedResult.ok && completedResult.ok && restoredResult.ok);
    const references = [preparedResult.data.reference, completedResult.data, ...restoredResult.data];
    for (const reference of references) {
      const shared = { index: 0, totalItems: 1, onChange: () => undefined,
        onRemove: () => undefined, canRemove: false, exampleMediaByKey: {} };
      const markup = renderToStaticMarkup(service === "Virtual Staging"
        ? createElement(StagingItemCard, {
            ...shared, defaultFurnitureStyle: "",
            data: { ...emptyStagingItem(), clientItemId: itemClientId, referenceFiles: [reference] },
          })
        : createElement(RenovationItemCard, {
            ...shared,
            data: { ...emptyRenovationItem(), clientItemId: itemClientId, referenceFiles: [reference] },
            onOriginalFileChange: () => undefined, onReferenceFilesChange: () => undefined,
            onRemovePersistedOriginal: () => undefined, onRemovePersistedReference: () => undefined,
          }));
      assert.equal(reference.id, id);
      assert.equal(reference.draftFileId, id);
      assert.equal(reference.storagePath, null);
      assert.match(markup, /1 of 10 files/);
      assert.ok(markup.includes(`data-reference-remove="${id}"`));
      assert.match(markup, /saved\.png/);
      if (reference.previewUrl) assert.match(markup, /storage\.example\/object\/sign\/order-files/);
    }
    assert.deepEqual(restoredResult.data, [completedResult.data]);
  });
}
