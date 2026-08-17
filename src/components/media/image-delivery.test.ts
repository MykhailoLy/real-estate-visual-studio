import assert from "node:assert/strict";
import test from "node:test";
import {
  getOptimizedImageDelivery,
  getPropertyGalleryImageContext,
} from "./image-delivery.ts";

test("property gallery contexts match the rendered responsive geometry", () => {
  assert.equal(getPropertyGalleryImageContext(1, 0), "property-gallery-single");
  assert.equal(getPropertyGalleryImageContext(2, 1), "property-gallery-half");
  assert.equal(getPropertyGalleryImageContext(3, 2), "property-gallery-wide-half");
  assert.equal(getPropertyGalleryImageContext(4, 1), "property-gallery-half");
  assert.equal(getPropertyGalleryImageContext(5, 1), "property-gallery-tile");
  assert.equal(getPropertyGalleryImageContext(5, 2), "property-gallery-wide");
});

test("lightbox delivery is constrained to the dialog width at mobile and desktop", () => {
  const propertyLightbox = getOptimizedImageDelivery("property-lightbox");
  const contentLightbox = getOptimizedImageDelivery("content-lightbox");

  for (const lightbox of [propertyLightbox, contentLightbox]) {
    assert.equal(lightbox.quality, 70);
    assert.match(lightbox.sizes, /calc\(100vw - 1\.5rem\)/);
    assert.match(lightbox.sizes, /calc\(100vw - 10rem\)/);
    assert.match(lightbox.sizes, /1600px/);
  }
});
