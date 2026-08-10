import assert from "node:assert/strict";
import test from "node:test";
import {
  GoogleMapsLinkDetectionCoordinator,
  type GoogleMapsLinkDetectionRequest,
} from "./google-maps-detection.ts";

type DetectionState = {
  currentLink: string;
  detectedLink: string | null;
  error: string | null;
  loading: boolean;
};

function settleSuccess(
  coordinator: GoogleMapsLinkDetectionCoordinator,
  request: GoogleMapsLinkDetectionRequest,
  state: DetectionState,
  detectedLink: string,
) {
  if (!coordinator.isCurrent(request, state.currentLink)) return;
  state.detectedLink = detectedLink;
  state.error = null;
  if (coordinator.finish(request, state.currentLink)) state.loading = false;
}

function settleError(
  coordinator: GoogleMapsLinkDetectionCoordinator,
  request: GoogleMapsLinkDetectionRequest,
  state: DetectionState,
  error: string,
) {
  if (!coordinator.isCurrent(request, state.currentLink)) return;
  state.error = error;
  if (coordinator.finish(request, state.currentLink)) state.loading = false;
}

test("a late success for link A cannot overwrite the newer success for link B", () => {
  const coordinator = new GoogleMapsLinkDetectionCoordinator();
  const state: DetectionState = {
    currentLink: "https://maps.app.goo.gl/A",
    detectedLink: null,
    error: null,
    loading: true,
  };
  const requestA = coordinator.begin(state.currentLink);

  state.currentLink = "https://maps.app.goo.gl/B";
  const requestB = coordinator.begin(state.currentLink);
  assert.equal(requestA.controller.signal.aborted, true);

  settleSuccess(coordinator, requestB, state, "https://www.google.com/maps/B");
  settleSuccess(coordinator, requestA, state, "https://www.google.com/maps/A");

  assert.equal(state.detectedLink, "https://www.google.com/maps/B");
  assert.equal(state.error, null);
  assert.equal(state.loading, false);
});

test("a late error for link A cannot overwrite the newer success for link B", () => {
  const coordinator = new GoogleMapsLinkDetectionCoordinator();
  const state: DetectionState = {
    currentLink: "https://maps.app.goo.gl/A",
    detectedLink: null,
    error: null,
    loading: true,
  };
  const requestA = coordinator.begin(state.currentLink);

  state.currentLink = "https://maps.app.goo.gl/B";
  const requestB = coordinator.begin(state.currentLink);
  settleSuccess(coordinator, requestB, state, "https://www.google.com/maps/B");
  settleError(coordinator, requestA, state, "A failed");

  assert.equal(state.detectedLink, "https://www.google.com/maps/B");
  assert.equal(state.error, null);
  assert.equal(state.loading, false);
});

test("only the latest request can clear the Detect loading state", () => {
  const coordinator = new GoogleMapsLinkDetectionCoordinator();
  const state: DetectionState = {
    currentLink: "https://maps.app.goo.gl/A",
    detectedLink: null,
    error: null,
    loading: true,
  };
  const requestA = coordinator.begin(state.currentLink);

  state.currentLink = "https://maps.app.goo.gl/B";
  const requestB = coordinator.begin(state.currentLink);
  settleError(coordinator, requestA, state, "A failed");
  assert.equal(state.loading, true);

  settleError(coordinator, requestB, state, "B failed");
  assert.equal(state.loading, false);
  assert.equal(state.error, "B failed");
});

test("input changes and unmounting invalidate late Detect responses", () => {
  const coordinator = new GoogleMapsLinkDetectionCoordinator();
  const state: DetectionState = {
    currentLink: "https://maps.app.goo.gl/A",
    detectedLink: null,
    error: null,
    loading: true,
  };
  const inputRequest = coordinator.begin(state.currentLink);

  state.currentLink = "https://maps.app.goo.gl/B";
  assert.equal(coordinator.invalidateForInputChange(state.currentLink), true);
  assert.equal(inputRequest.controller.signal.aborted, true);
  settleSuccess(coordinator, inputRequest, state, "https://www.google.com/maps/A");
  assert.equal(state.detectedLink, null);

  const unmountRequest = coordinator.begin(state.currentLink);
  coordinator.dispose();
  assert.equal(unmountRequest.controller.signal.aborted, true);
  settleError(coordinator, unmountRequest, state, "Late error");
  assert.equal(state.error, null);
});
