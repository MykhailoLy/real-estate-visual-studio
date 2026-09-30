import type { Page } from "@playwright/test";

export const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
type TurnstileTestState = {
  renderCount: number;
  resetCount: number;
  removeCount: number;
  latestToken: string | null;
  widgets: Array<{
    id: string;
    action: string | null;
    sitekey: string | null;
  }>;
};

export async function installFakeTurnstile(page: Page) {
  let scriptRequests = 0;

  await page.route(TURNSTILE_SCRIPT_SRC, async (route) => {
    scriptRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: `
(() => {
  const state = {
    renderCount: 0,
    resetCount: 0,
    removeCount: 0,
    latestOptions: null,
    latestToken: null,
    autoComplete: true,
    widgets: [],
  };

  function complete(token) {
    state.latestToken = token || "token-" + state.latestOptions.action + "-" + crypto.randomUUID();
    state.latestOptions.callback(state.latestToken);
  }

  window.__turnstileTest = {
    state: () => ({
      renderCount: state.renderCount,
      resetCount: state.resetCount,
      removeCount: state.removeCount,
      latestToken: state.latestToken,
      widgets: state.widgets.map((widget) => ({ ...widget })),
    }),
    expire: () => state.latestOptions && state.latestOptions["expired-callback"](),
    fail: () => state.latestOptions && state.latestOptions["error-callback"](),
    complete,
    setAutoComplete: (enabled) => { state.autoComplete = enabled; },
  };

  window.turnstile = {
    render: (container, options) => {
      state.renderCount += 1;
      state.latestOptions = options;

      const id = "turnstile-widget-" + state.renderCount;
      state.widgets.push({
        id,
        action: options.action || null,
        sitekey: options.sitekey || null,
      });

      const widget = document.createElement("div");
      widget.setAttribute("data-testid", "fake-turnstile-widget");
      widget.textContent = "Security check (" + options.action + ")";
      widget.style.width = "300px";
      widget.style.height = "65px";
      container.replaceChildren(widget);

      queueMicrotask(() => {
        if (state.autoComplete) complete();
      });

      return id;
    },
    reset: () => {
      state.resetCount += 1;
      const options = state.latestOptions;
      if (options) {
        queueMicrotask(() => {
          if (state.autoComplete) complete("token-reset-" + crypto.randomUUID());
        });
      }
    },
    remove: () => {
      state.removeCount += 1;
    },
  };
})();
      `,
    });
  });

  return {
    requestCount() {
      return scriptRequests;
    },
  };
}

export async function getTurnstileState(page: Page): Promise<TurnstileTestState> {
  return page.evaluate(() => {
    const windowWithTest = window as unknown as {
      __turnstileTest: { state: () => TurnstileTestState };
    };

    return windowWithTest.__turnstileTest.state();
  });
}

export async function expireTurnstile(page: Page) {
  await page.evaluate(() => {
    const windowWithTest = window as unknown as {
      __turnstileTest: { expire: () => void };
    };

    windowWithTest.__turnstileTest.expire();
  });
}

export async function failTurnstile(page: Page) {
  await page.evaluate(() => {
    const windowWithTest = window as unknown as {
      __turnstileTest: { fail: () => void };
    };

    windowWithTest.__turnstileTest.fail();
  });
}

export async function completeTurnstile(page: Page, token?: string) {
  await page.evaluate((value) => {
    (window as unknown as { __turnstileTest: { complete: (token?: string) => void } }).__turnstileTest.complete(value);
  }, token);
}

export async function setTurnstileAutoComplete(page: Page, enabled: boolean) {
  await page.evaluate((value) => {
    (window as unknown as { __turnstileTest: { setAutoComplete: (enabled: boolean) => void } }).__turnstileTest.setAutoComplete(value);
  }, enabled);
}
