import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { ImageResponse } from "next/og.js";
import sharp from "sharp";
import { costaBlancaDemo } from "./registry.ts";
import type {
  PreparedPropertySocialAssets,
  PreparedPropertySocialImage,
} from "./social-image-preparation.ts";
import {
  createPropertySocialImageHandler,
  hasPngSignature,
  type PropertySocialCardRenderInput,
} from "./social-image-response.ts";
import { getPropertySocialPreview } from "./social-preview.ts";
import type { PropertyShowcase } from "./types.ts";

function cloneProperty(): PropertyShowcase {
  return structuredClone(costaBlancaDemo);
}

function preparedAssets(
  property: PropertyShowcase,
  imageCount: number,
): PreparedPropertySocialAssets {
  const propertyImages: PreparedPropertySocialImage[] = Array.from(
    { length: imageCount },
    (_, index) => ({
      imageUrl: `data:image/jpeg;base64,photo-${index}`,
      imageAlt: `Photo ${index + 1}`,
      byteLength: 7,
      contentType: "image/jpeg",
    }),
  );
  return {
    preview: getPropertySocialPreview(property),
    propertyImages,
    brandingLogo: null,
    candidateCount: imageCount,
    skippedPhotoCount: 0,
    totalBytes: propertyImages.length * 7,
  };
}

function renderSimplePng(input: PropertySocialCardRenderInput): Response {
  return new ImageResponse(
    React.createElement(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0B1F3A",
          color: "white",
          fontSize: 44,
        },
      },
      input.preview.title,
    ),
    { width: 1200, height: 630 },
  );
}

async function emergencyPng() {
  return sharp({
    create: {
      width: 1200,
      height: 630,
      channels: 3,
      background: "#0B1F3A",
    },
  })
    .png()
    .toBuffer();
}

function request(slug: string) {
  return new Request(`https://picchuspot.com/property/${slug}/opengraph-image`);
}

test("route handler returns a real 1200 by 630 PNG for an existing fixture", async () => {
  const property = cloneProperty();
  const handler = createPropertySocialImageHandler({
    resolveProperty: async () => property,
    prepareAssets: async () => preparedAssets(property, 0),
    renderCard: renderSimplePng,
    loadEmergencyPng: emergencyPng,
  });

  const response = await handler(request(property.slug), {
    params: Promise.resolve({ slug: property.slug }),
  });
  const bytes = new Uint8Array(await response.arrayBuffer());
  const metadata = await sharp(bytes).metadata();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^image\/png/);
  assert.equal(hasPngSignature(bytes), true);
  assert.equal(metadata.width, 1200);
  assert.equal(metadata.height, 630);
  assert.equal(response.headers.get("x-picchuspot-social-image-level"), "text");
  assert.equal(
    response.headers.get("x-picchuspot-social-card-layout"),
    "balanced",
  );
});

test("a full render failure retries a reduced primary-only card", async () => {
  const property = cloneProperty();
  const levels: string[] = [];
  const handler = createPropertySocialImageHandler({
    resolveProperty: async () => property,
    prepareAssets: async () => preparedAssets(property, 3),
    renderCard: (input) => {
      levels.push(input.level);
      if (input.level === "full") throw new Error("renderer failed");
      return renderSimplePng(input);
    },
    loadEmergencyPng: emergencyPng,
    log: () => undefined,
  });

  const response = await handler(request(property.slug), {
    params: Promise.resolve({ slug: property.slug }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(levels, ["full", "reduced"]);
  assert.equal(
    response.headers.get("x-picchuspot-social-image-status"),
    "generated",
  );
  assert.equal(
    response.headers.get("x-picchuspot-social-image-level"),
    "reduced",
  );
});

test("a primary ImageResponse failure returns a branded text PNG fallback", async () => {
  const property = cloneProperty();
  const levels: string[] = [];
  const handler = createPropertySocialImageHandler({
    resolveProperty: async () => property,
    prepareAssets: async () => preparedAssets(property, 1),
    renderCard: (input) => {
      levels.push(input.level);
      if (input.level === "full") throw new Error("primary render failed");
      return renderSimplePng(input);
    },
    loadEmergencyPng: emergencyPng,
    log: () => undefined,
  });

  const response = await handler(request(property.slug), {
    params: Promise.resolve({ slug: property.slug }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(levels, ["full", "text"]);
  assert.equal(
    response.headers.get("x-picchuspot-social-image-status"),
    "fallback",
  );
  assert.equal(response.headers.get("x-picchuspot-social-image-level"), "text");
});

test("all ImageResponse failures return the bundled emergency PNG", async () => {
  const property = cloneProperty();
  const fallback = await emergencyPng();
  const handler = createPropertySocialImageHandler({
    resolveProperty: async () => property,
    prepareAssets: async () => preparedAssets(property, 1),
    renderCard: () => {
      throw new Error("renderer unavailable");
    },
    loadEmergencyPng: async () => fallback,
    log: () => undefined,
  });

  const response = await handler(request(property.slug), {
    params: Promise.resolve({ slug: property.slug }),
  });
  const bytes = new Uint8Array(await response.arrayBuffer());

  assert.equal(response.status, 200);
  assert.equal(hasPngSignature(bytes), true);
  assert.equal(
    response.headers.get("x-picchuspot-social-image-level"),
    "emergency",
  );
  assert.equal(
    response.headers.get("x-picchuspot-social-card-layout"),
    "emergency",
  );
  assert.deepEqual(Buffer.from(bytes), fallback);
});

test("a genuinely unknown property remains a 404", async () => {
  const handler = createPropertySocialImageHandler({
    resolveProperty: async () => null,
    prepareAssets: async () => {
      throw new Error("must not prepare unknown properties");
    },
    renderCard: () => {
      throw new Error("must not render unknown properties");
    },
    loadEmergencyPng: emergencyPng,
  });

  const response = await handler(request("missing-property"), {
    params: Promise.resolve({ slug: "missing-property" }),
  });

  assert.equal(response.status, 404);
  assert.match(response.headers.get("content-type") ?? "", /^text\/plain/);
});
