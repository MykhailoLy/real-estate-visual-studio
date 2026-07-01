import type { SupportOrderAction } from "../support-order-action.ts";

export type SupportAssistantHistoryRole = "user" | "assistant";

export interface SupportAssistantHistoryMessage {
  role: SupportAssistantHistoryRole;
  content: string;
}

export interface SupportAssistantRequestInput {
  message: string;
  history: SupportAssistantHistoryMessage[];
}

export interface SupportAssistantGeneratedReply {
  message: string;
  action?: SupportOrderAction;
}

export interface SupportAssistantTransport {
  generate(input: string): Promise<string>;
}

export type SupportRateLimitDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export interface SupportAssistantRateLimiter {
  check(request: Request): Promise<SupportRateLimitDecision>;
}

export type SupportAssistantGenerationLogCategory =
  | "generation_failed"
  | "provider_incomplete"
  | "provider_budget_exceeded"
  | "provider_failed"
  | "provider_unexpected_status";

export class SupportAssistantInputError extends Error {
  constructor(message = "Support assistant input is invalid.") {
    super(message);
    this.name = "SupportAssistantInputError";
  }
}

export class SupportAssistantConfigurationError extends Error {
  constructor(message = "Support assistant is not configured.") {
    super(message);
    this.name = "SupportAssistantConfigurationError";
  }
}

export class SupportAssistantGenerationError extends Error {
  readonly logCategory: SupportAssistantGenerationLogCategory;

  constructor(
    message = "Support assistant generation failed.",
    logCategory: SupportAssistantGenerationLogCategory = "generation_failed",
  ) {
    super(message);
    this.name = "SupportAssistantGenerationError";
    this.logCategory = logCategory;
  }
}

export class SupportAssistantRateLimitUnavailableError extends Error {
  constructor(message = "Support assistant rate limit is unavailable.") {
    super(message);
    this.name = "SupportAssistantRateLimitUnavailableError";
  }
}
