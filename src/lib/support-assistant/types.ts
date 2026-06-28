export type SupportAssistantHistoryRole = "user" | "assistant";

export interface SupportAssistantHistoryMessage {
  role: SupportAssistantHistoryRole;
  content: string;
}

export interface SupportAssistantRequestInput {
  message: string;
  history: SupportAssistantHistoryMessage[];
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
  constructor(message = "Support assistant generation failed.") {
    super(message);
    this.name = "SupportAssistantGenerationError";
  }
}

export class SupportAssistantRateLimitUnavailableError extends Error {
  constructor(message = "Support assistant rate limit is unavailable.") {
    super(message);
    this.name = "SupportAssistantRateLimitUnavailableError";
  }
}
