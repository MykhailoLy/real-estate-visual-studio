import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { PDFDocument } from "pdf-lib";
import { ImageResponse } from "next/og.js";
import sharp from "sharp";
import { costaBlancaDemo } from "./registry.ts";
import {
  createPropertyMarketingMaterialResponse,
  encodePropertyMarketingMaterialFormat,
  propertyMarketingPreviewHeaders,
} from "./marketing-material-response.ts";
import type { PropertyShowcase } from "./types.ts";

const canonicalUrl = "https://picchuspot.com/property/sea-view-residence";

function property(): PropertyShowcase {
  const value = structuredClone(costaBlancaDemo);
  value.marketingMaterials = {
    enabled: true,
    brochure: { orientation: "portrait", template: "a4-editorial" },
  };
  return value;
}

async function syntheticPng(width: number, height: number): Promise<Uint8Array> {
  const response = new ImageResponse(
    React.createElement(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#0B1F3A",
          color: "white",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 64,
        },
      },
      "PicchuSpot property material",
    ),
    { width, height },
  );
  return new Uint8Array(await response.arrayBuffer());
}

test("canonical landscape raster converts once to exact JPG and one-page 16:9 PDF", async () => {
  const png = await syntheticPng(1920, 1080);
  const pngMetadata = await sharp(png).metadata();
  assert.deepEqual([pngMetadata.width, pngMetadata.height], [1920, 1080]);
  const jpg = await encodePropertyMarketingMaterialFormat(
    png,
    "brochure.jpg",
    "landscape",
  );
  assert.equal(jpg.contentType, "image/jpeg");
  const jpgMetadata = await sharp(jpg.bytes).metadata();
  assert.deepEqual([jpgMetadata.width, jpgMetadata.height], [1920, 1080]);
  const pdf = await encodePropertyMarketingMaterialFormat(
    png,
    "brochure.pdf",
    "landscape",
  );
  const document = await PDFDocument.load(pdf.bytes);
  assert.equal(document.getPageCount(), 1);
  const page = document.getPage(0);
  assert.ok(Math.abs(page.getWidth() - 960) < 0.01);
  assert.ok(Math.abs(page.getHeight() - 540) < 0.01);
  assert.ok(Math.abs(page.getWidth() / page.getHeight() - 16 / 9) < 0.0001);
});

test("canonical portrait PNG converts to exact A4 raster JPG and one-page A4 PDF", async () => {
  const png = await syntheticPng(2480, 3508);
  const pngMetadata = await sharp(png).metadata();
  assert.deepEqual([pngMetadata.width, pngMetadata.height], [2480, 3508]);

  const jpg = await encodePropertyMarketingMaterialFormat(
    png,
    "brochure.jpg",
    "portrait",
  );
  assert.equal(jpg.contentType, "image/jpeg");
  const jpgMetadata = await sharp(jpg.bytes).metadata();
  assert.deepEqual([jpgMetadata.width, jpgMetadata.height], [2480, 3508]);

  const pdf = await encodePropertyMarketingMaterialFormat(
    png,
    "brochure.pdf",
    "portrait",
  );
  assert.equal(pdf.contentType, "application/pdf");
  const document = await PDFDocument.load(pdf.bytes);
  assert.equal(document.getPageCount(), 1);
  const page = document.getPage(0);
  assert.ok(Math.abs(page.getWidth() - 595.28) < 0.01);
  assert.ok(Math.abs(page.getHeight() - 841.89) < 0.01);
});

test("disabled and stale public material requests fail with no-store before rendering", async () => {
  const disabled = property();
  disabled.marketingMaterials = { enabled: false };
  const unavailable = await createPropertyMarketingMaterialResponse({
    property: disabled,
    canonicalUrl,
    asset: "brochure.pdf",
    requestUrl: `${canonicalUrl}/materials/brochure.pdf?v=stale`,
  });
  assert.equal(unavailable.status, 404);
  assert.equal(unavailable.headers.get("cache-control"), "no-store");

  const stale = await createPropertyMarketingMaterialResponse({
    property: property(),
    canonicalUrl,
    asset: "brochure.png",
    requestUrl: `${canonicalUrl}/materials/brochure.png?v=stale`,
  });
  assert.equal(stale.status, 404);
  assert.equal(stale.headers.get("cache-control"), "no-store");
});

test("admin live preview headers use reduced dimensions and are never cacheable", () => {
  const portrait = new Headers(propertyMarketingPreviewHeaders("portrait"));
  assert.equal(portrait.get("cache-control"), "private, no-store");
  assert.equal(portrait.get("x-picchuspot-preview-width"), "620");
  assert.equal(portrait.get("x-picchuspot-preview-height"), "877");
  const landscape = new Headers(propertyMarketingPreviewHeaders("landscape"));
  assert.equal(landscape.get("x-picchuspot-preview-width"), "960");
  assert.equal(landscape.get("x-picchuspot-preview-height"), "540");
});
