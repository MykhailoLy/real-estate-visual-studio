import type { TurnstileAction } from "./turnstile";

export {};

type TurnstileWidgetId = string;

type TurnstileRenderOptions = {
  sitekey: string;
  action?: TurnstileAction;
  callback?: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
};

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        options: TurnstileRenderOptions,
      ) => TurnstileWidgetId;
      reset?: (widgetId?: TurnstileWidgetId) => void;
      remove?: (widgetId: TurnstileWidgetId) => void;
    };
  }
}

