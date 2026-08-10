import assert from "node:assert/strict";
import test from "node:test";
import {
  hasCollapsedMobileGalleryImages,
  MOBILE_GALLERY_INITIAL_IMAGE_COUNT,
  shouldShowMobileGalleryImage,
} from "./mobile-gallery.ts";

test("mobile galleries show five photos by default and reveal the rest on demand", () => {
  assert.equal(MOBILE_GALLERY_INITIAL_IMAGE_COUNT, 5);
  assert.equal(hasCollapsedMobileGalleryImages(5), false);
  assert.equal(hasCollapsedMobileGalleryImages(6), true);
  assert.equal(shouldShowMobileGalleryImage(4, false), true);
  assert.equal(shouldShowMobileGalleryImage(5, false), false);
  assert.equal(shouldShowMobileGalleryImage(5, true), true);
});
