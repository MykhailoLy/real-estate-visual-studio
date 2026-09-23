import { expect, test, type Page } from "@playwright/test";

const ORIGIN = "http://127.0.0.1:3210";
const STORAGE_KEY = "picchuspot:order-submission:v1:photo-editing";
const ORDER_ID = "aaaaaaaa-1111-4111-8111-111111111111";
const ORDER_NUMBER = "PS-F3-FIXTURE";
const LEGACY_ID = "bbbbbbbb-2222-4222-8222-222222222222";
const sourceFile = { name: "fixture.jpg", mimeType: "image/jpeg", buffer: Buffer.from([255, 216, 255, 224, 0, 16]) };
type Reply = { status: number; body: Record<string, unknown> | string };
type BrowserRecord = { submissionId: string; stage: string; requestBody?: string };
type PostSnapshot = { body: string; record: BrowserRecord };

function barrier<T>() {
  let release!: (value: T) => void;
  const promise = new Promise<T>((resolve) => { release = resolve; });
  return { promise, release };
}

const committed = (submissionId: string): Reply => ({
  status: 200,
  body: { status: "committed", submissionId, orderId: ORDER_ID, orderNumber: ORDER_NUMBER },
});
const successfulPost: Reply = {
  status: 200,
  body: { orderId: ORDER_ID, orderNumber: ORDER_NUMBER, emailNotifications: { clientConfirmation: false } },
};

async function installFixture(page: Page) {
  const requests: string[] = [];
  const postBodies: string[] = [];
  const posts = [barrier<Reply>(), barrier<Reply>(), barrier<Reply>()];
  const arrivals = [barrier<void>(), barrier<void>(), barrier<void>()];
  const violations: string[] = [];
  const pageErrors: string[] = [];
  let uploadError: Reply | null = null;
  let recovery: (id: string) => Reply = (submissionId) => ({ status: 200, body: { status: "processing", submissionId } });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== ORIGIN) {
      violations.push(request.url());
      await route.abort("blockedbyclient");
      return;
    }
    requests.push(`${request.method()} ${url.pathname}`);
    if (url.pathname === "/api/upload-url") {
      if (uploadError) {
        await route.fulfill({ status: uploadError.status, json: uploadError.body });
        return;
      }
      const body = request.postDataJSON() as { pendingToken: string };
      const path = `synthetic-owner/pending/${body.pendingToken}/0-original.jpg`;
      await route.fulfill({ json: { bucket: "order-files", path, token: "synthetic-signed-token", signedUrl: `${ORIGIN}/__supabase/storage/${path}` } });
    } else if (url.pathname.startsWith("/__supabase/storage/")) {
      await route.fulfill({ json: { Key: "synthetic-upload", Id: "synthetic-upload" } });
    } else if (url.pathname.startsWith("/api/order/submissions/")) {
      const reply = recovery(url.pathname.split("/").at(-1)!);
      await route.fulfill({ status: reply.status, contentType: "application/json", body: typeof reply.body === "string" ? reply.body : JSON.stringify(reply.body) });
    } else if (url.pathname === "/api/order") {
      const index = postBodies.length;
      postBodies.push(request.postData()!);
      arrivals[index].release();
      const reply = await posts[index].promise;
      // Reload cancels the browser's response consumer. The held fixture reply
      // can still be released independently, just like an already-started POST.
      await route.fulfill({ status: reply.status, contentType: "application/json", body: JSON.stringify(reply.body) }).catch(() => undefined);
    } else {
      await route.continue();
    }
  });
  return {
    postBodies,
    requests,
    arrivals,
    posts,
    setUploadError(reply: Reply) { uploadError = reply; },
    setRecovery(handler: (id: string) => Reply) { recovery = handler; },
    assertClean() { expect(violations).toEqual([]); expect(pageErrors).toEqual([]); },
  };
}

async function readPostSnapshots(page: Page): Promise<PostSnapshot[]> {
  return page.evaluate(() => (window as unknown as {
    __submissionFixture: { atPost: PostSnapshot[] };
  }).__submissionFixture.atPost);
}

async function readRecord(page: Page): Promise<BrowserRecord | null> {
  return page.evaluate((key) => JSON.parse(sessionStorage.getItem(key) ?? "null") as BrowserRecord | null, STORAGE_KEY);
}

async function startSubmission(page: Page, fixture: Awaited<ReturnType<typeof installFixture>>) {
  await page.goto("/");
  await page.getByLabel("Source image").setInputFiles(sourceFile);
  await page.getByRole("button", { name: "Submit synthetic order" }).click();
  await fixture.arrivals[0].promise;
  const [snapshot] = await readPostSnapshots(page);
  expect(snapshot.record.stage).toBe("ambiguous");
  expect(snapshot.record.requestBody).toBe(snapshot.body);
  expect(JSON.parse(snapshot.body).submissionId).toBe(snapshot.record.submissionId);
  return snapshot;
}

test("real submitOrder persists uncertainty before POST; reload finds committed order without uploading again", async ({ page }) => {
  const fixture = await installFixture(page);
  const snapshot = await startSubmission(page, fixture);
  fixture.setRecovery(committed);
  await page.reload();
  await expect(page).toHaveURL(`${ORIGIN}/dashboard/jobs/${ORDER_ID}`);
  await expect(page.getByRole("heading", { name: "Existing order fixture" })).toBeVisible();
  expect(fixture.postBodies).toEqual([snapshot.body]);
  expect(fixture.requests.filter((request) => request === "POST /api/upload-url")).toHaveLength(1);
  expect(await readRecord(page)).toBeNull();
  fixture.posts[0].release(successfulPost);
  fixture.assertClean();
});

test("released lease offers explicit retry of exact original body and uploaded references at all requested widths", async ({ page }) => {
  const fixture = await installFixture(page);
  const snapshot = await startSubmission(page, fixture);
  fixture.setRecovery((submissionId) => ({ status: 200, body: { status: "retryable", submissionId } }));
  fixture.posts[0].release({ status: 500, body: { error: "Synthetic Storage failure" } });
  // The production gate immediately replaces the failed form via its recovery
  // event. The same explicit retry must remain available after a full reload.
  await expect(page.getByRole("button", { name: "Retry original submission" })).toBeVisible();
  await page.reload();
  const retry = page.getByRole("button", { name: "Retry original submission" });
  await expect(retry).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit synthetic order" })).toHaveCount(0);
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(retry).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await retry.focus();
    await expect(retry).toBeFocused();
    expect(await retry.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe("none");
    expect(await retry.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe("rgba(0, 0, 0, 0)");
    expect(await page.getByRole("button", { name: "Check again" }).evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe("rgba(0, 0, 0, 0)");
    const retryBox = await retry.boundingBox();
    const checkBox = await page.getByRole("button", { name: "Check again" }).boundingBox();
    expect(retryBox).not.toBeNull();
    expect(checkBox).not.toBeNull();
    expect(retryBox!.x + retryBox!.width <= checkBox!.x || retryBox!.y + retryBox!.height <= checkBox!.y).toBe(true);
    if (width === 360 || width === 1440) {
      await page.screenshot({ path: test.info().outputPath(`retry-${width}.png`) });
    }
  }
  await page.keyboard.press("Enter");
  await fixture.arrivals[1].promise;
  expect(fixture.postBodies).toEqual([snapshot.body, snapshot.body]);
  expect(fixture.requests.filter((request) => request === "POST /api/upload-url")).toHaveLength(1);
  fixture.posts[1].release(successfulPost);
  await expect(page).toHaveURL(`${ORIGIN}/dashboard/jobs/${ORDER_ID}`);
  expect(await readRecord(page)).toBeNull();
  fixture.assertClean();
});

test("reload before claim and recovery 404 preserves ID while original and retry requests overlap", async ({ page }) => {
  const fixture = await installFixture(page);
  const snapshot = await startSubmission(page, fixture);
  fixture.setRecovery(() => ({ status: 404, body: { code: "submission_unavailable" } }));
  await page.reload();
  await expect(page.getByRole("button", { name: "Retry original submission" })).toBeVisible();
  expect((await readRecord(page))?.submissionId).toBe(snapshot.record.submissionId);
  await expect(page.getByRole("button", { name: "Submit synthetic order" })).toHaveCount(0);
  await page.getByRole("button", { name: "Retry original submission" }).evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await fixture.arrivals[1].promise;
  // Both POST response barriers remain held here. This proves browser ID/body
  // reuse under overlap; PostgreSQL claim/commit concurrency is tested elsewhere.
  expect(fixture.postBodies).toEqual([snapshot.body, snapshot.body]);
  fixture.posts[1].release(successfulPost);
  await expect(page).toHaveURL(`${ORIGIN}/dashboard/jobs/${ORDER_ID}`);
  fixture.posts[0].release(successfulPost);
  fixture.assertClean();
});

test("active processing blocks form, preserves context and only checks again after explicit action", async ({ page }) => {
  await page.clock.install();
  const fixture = await installFixture(page);
  const snapshot = await startSubmission(page, fixture);
  await page.reload();
  await expect(page.getByText(/previous order submission is still processing/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry original submission" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Submit synthetic order" })).toHaveCount(0);
  const checksBeforeClock = fixture.requests.filter((request) => request.startsWith("GET /api/order/submissions/")).length;
  await page.clock.runFor(60000);
  expect(fixture.requests.filter((request) => request.startsWith("GET /api/order/submissions/"))).toHaveLength(checksBeforeClock);
  expect((await readRecord(page))?.submissionId).toBe(snapshot.record.submissionId);
  fixture.setRecovery(committed);
  await page.getByRole("button", { name: "Check again" }).click();
  await expect(page).toHaveURL(`${ORIGIN}/dashboard/jobs/${ORDER_ID}`);
  expect(fixture.requests.filter((request) => request.startsWith("GET /api/order/submissions/"))).toHaveLength(checksBeforeClock + 1);
  fixture.posts[0].release(successfulPost);
  fixture.assertClean();
});

for (const outcome of ["committed", "not-started"] as const) {
  test(`legacy uploaded record with ${outcome} outcome is recovered before exposing a new form`, async ({ page }) => {
    const fixture = await installFixture(page);
    fixture.setRecovery(outcome === "committed" ? committed : () => ({ status: 404, body: { code: "submission_unavailable" } }));
    await page.addInitScript(({ key, id }) => {
      if (location.pathname !== "/") return;
      sessionStorage.setItem(key, JSON.stringify({
        submissionId: id, intentHash: "a".repeat(64), stage: "uploaded", referenceIds: [[]],
        itemFiles: [{ original: { bucket: "order-files", path: "synthetic-owner/pending/legacy/0-original.jpg", originalFilename: "fixture.jpg", size: 6, mimeType: "image/jpeg" }, reference: null, references: [] }],
      }));
    }, { key: STORAGE_KEY, id: LEGACY_ID });
    await page.goto("/");
    if (outcome === "committed") {
      await expect(page).toHaveURL(`${ORIGIN}/dashboard/jobs/${ORDER_ID}`);
      expect(await readRecord(page)).toBeNull();
    } else {
      await expect(page.getByRole("heading", { name: "Recovering your order" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Retry original submission" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Submit synthetic order" })).toHaveCount(0);
      expect((await readRecord(page))?.submissionId).toBe(LEGACY_ID);
    }
    expect(fixture.postBodies).toHaveLength(0);
    expect(fixture.requests.filter((request) => request === "POST /api/upload-url")).toHaveLength(0);
    fixture.assertClean();
  });
}

test("unauthorized and malformed recovery keep context and prevent new order creation", async ({ page }) => {
  const fixture = await installFixture(page);
  const snapshot = await startSubmission(page, fixture);
  fixture.setRecovery(() => ({ status: 401, body: { error: "Synthetic expired session" } }));
  await page.reload();
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login?redirectTo=%2Fdashboard%2Forders%2Fnew");
  expect((await readRecord(page))?.requestBody).toBe(snapshot.body);
  fixture.setRecovery(() => ({ status: 200, body: "not JSON" }));
  await page.reload();
  await expect(page.getByText(/outcome could not be confirmed/)).toBeVisible();
  expect((await readRecord(page))?.requestBody).toBe(snapshot.body);
  await expect(page.getByRole("button", { name: "Submit synthetic order" })).toHaveCount(0);
  expect(fixture.postBodies).toHaveLength(1);
  fixture.posts[0].release(successfulPost);
  fixture.assertClean();
});

test("failure before POST preserves the current form and selected File", async ({ page }) => {
  const fixture = await installFixture(page);
  fixture.setUploadError({ status: 500, body: { error: "Synthetic upload URL failure" } });
  await page.goto("/");
  await page.getByLabel("Job title").fill("Unsaved original details");
  await page.getByLabel("Source image").setInputFiles(sourceFile);
  await page.getByRole("button", { name: "Submit synthetic order" }).click();
  await expect(page.getByTestId("submit-result")).toContainText("upload-url-failed");
  await expect(page.getByLabel("Job title")).toHaveValue("Unsaved original details");
  expect(await page.getByLabel("Source image").evaluate((input) => (input as HTMLInputElement).files?.[0]?.name)).toBe("fixture.jpg");
  expect(fixture.postBodies).toHaveLength(0);
  fixture.assertClean();
});
