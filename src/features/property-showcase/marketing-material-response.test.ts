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
} from "./marketing-material-response.ts";
import type { PropertyShowcase } from "./types.ts";

const canonicalUrl = "https://picchuspot.com/property/sea-view-residence";

function property(): PropertyShowcase {
  const value = structuredClone(costaBlancaDemo);
  value.marketingMaterials = {
    enabled: true,
    landscape: { enabled: true, layout: "hero-two-square" },
    portrait: { enabled: true, layout: "a4-editorial" },
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

test("canonical landscape PNG converts to an exact 1920 by 1080 quality JPG", async () => {
  const png = await syntheticPng(1920, 1080);
  const pngMetadata = await sharp(png).metadata();
  assert.deepEqual([pngMetadata.width, pngMetadata.height], [1920, 1080]);
  const jpg = await encodePropertyMarketingMaterialFormat(png, "landscape.jpg");
  assert.equal(jpg.contentType, "image/jpeg");
  const jpgMetadata = await sharp(jpg.bytes).metadata();
  assert.deepEqual([jpgMetadata.width, jpgMetadata.height], [1920, 1080]);
});

test("canonical portrait PNG converts to exact A4 raster JPG and one-page A4 PDF", async () => {
  const png = await syntheticPng(2480, 3508);
  const pngMetadata = await sharp(png).metadata();
  assert.deepEqual([pngMetadata.width, pngMetadata.height], [2480, 3508]);

  const jpg = await encodePropertyMarketingMaterialFormat(png, "flyer.jpg");
  assert.equal(jpg.contentType, "image/jpeg");
  const jpgMetadata = await sharp(jpg.bytes).metadata();
  assert.deepEqual([jpgMetadata.width, jpgMetadata.height], [2480, 3508]);

  const pdf = await encodePropertyMarketingMaterialFormat(png, "flyer.pdf");
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
    asset: "flyer.pdf",
    requestUrl: `${canonicalUrl}/materials/flyer.pdf?v=stale`,
  });
  assert.equal(unavailable.status, 404);
  assert.equal(unavailable.headers.get("cache-control"), "no-store");

  const stale = await createPropertyMarketingMaterialResponse({
    property: property(),
    canonicalUrl,
    asset: "landscape.png",
    requestUrl: `${canonicalUrl}/materials/landscape.png?v=stale`,
  });
  assert.equal(stale.status, 404);
  assert.equal(stale.headers.get("cache-control"), "no-store");
});
