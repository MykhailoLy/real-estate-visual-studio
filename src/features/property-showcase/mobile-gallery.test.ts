import assert from "node:assert/strict";
import test from "node:test";
import {
  hasCollapsedPropertyGalleryImages,
  propertyGalleryCompactLayout,
  PROPERTY_GALLERY_COLLAPSED_IMAGE_COUNT,
  shouldShowPropertyGalleryImage,
  visiblePropertyGalleryImageCount,
} from "./mobile-gallery.ts";

test("gallery disclosure keeps 1, 2, and 5 photos fully visible", () => {
  assert.equal(PROPERTY_GALLERY_COLLAPSED_IMAGE_COUNT, 5);
  for (const imageCount of [1, 2, 5]) {
    assert.equal(visiblePropertyGalleryImageCount(imageCount, false), imageCount);
    assert.equal(hasCollapsedPropertyGalleryImages(imageCount), false);
  }
  assert.equal(propertyGalleryCompactLayout(1), "single");
  assert.equal(propertyGalleryCompactLayout(2), "pair");
  assert.equal(propertyGalleryCompactLayout(5), "mosaic");
});

test("gallery disclosure shows five of 6+ photos until expanded", () => {
  assert.equal(hasCollapsedPropertyGalleryImages(6), true);
  assert.equal(visiblePropertyGalleryImageCount(6, false), 5);
  assert.equal(visiblePropertyGalleryImageCount(6, true), 6);
  assert.equal(propertyGalleryCompactLayout(5), "mosaic");
  assert.equal(shouldShowPropertyGalleryImage(4, false), true);
  assert.equal(shouldShowPropertyGalleryImage(5, false), false);
  assert.equal(shouldShowPropertyGalleryImage(5, true), true);
});
