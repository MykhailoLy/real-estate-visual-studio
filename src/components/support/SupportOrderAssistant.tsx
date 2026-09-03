"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ORDER_ASSISTANT_INITIAL_QUESTION_ID,
  getLocalizedOrderAssistantRecommendation,
  getOrderAssistantQuestion,
  orderAssistantCopy,
  type LocalizedOrderAssistantChoice,
  type OrderAssistantGoalId,
} from "@/components/support/support-order-assistant";
import type { SupportChatLanguage } from "@/components/support/support-chat-copy";

interface SupportOrderAssistantProps {
  language: SupportChatLanguage;
  onNavigate: (href: string) => void;
  onBackToChat: () => void;
}

export default function SupportOrderAssistant({
  language,
  onNavigate,
  onBackToChat,
}: SupportOrderAssistantProps) {
  const copy = orderAssistantCopy[language];
  const [selectedGoalId, setSelectedGoalId] =
    useState<OrderAssistantGoalId | null>(null);
  const recommendationHeadingRef = useRef<HTMLHeadingElement | null>(null);

  const question = useMemo(
    () => getOrderAssistantQuestion(language, ORDER_ASSISTANT_INITIAL_QUESTION_ID),
    [language],
  );
  const recommendation = useMemo(
    () =>
      selectedGoalId
        ? getLocalizedOrderAssistantRecommendation(language, selectedGoalId)
        : null,
    [language, selectedGoalId],
  );
  const recommendationId = recommendation?.id ?? null;

  useEffect(() => {
    if (!recommendationId) return;

    const timeoutId = window.setTimeout(() => {
      recommendationHeadingRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [recommendationId]);

  const resetChooser = () => {
    setSelectedGoalId(null);
  };

  const handleChoice = (choice: LocalizedOrderAssistantChoice) => {
    setSelectedGoalId(choice.id);
  };

  if (recommendation) {
    return (
      <div className="space-y-3" aria-live="polite">
        <div className="rounded-xl border border-primary/15 bg-primary/5 p-3">
          <p className="text-dashboard-kicker font-bold uppercase text-secondary-dark">
            {copy.recommendedHeading}
          </p>
          <h3
            ref={recommendationHeadingRef}
            tabIndex={-1}
            className="mt-1 text-base font-bold text-primary focus:outline-none"
          >
            {recommendation.label}
          </h3>
          <p className="mt-2 text-dashboard-body text-muted">
            {recommendation.reason}
          </p>
        </div>

        <div className="grid gap-2">
          <button
            type="button"
            onClick={() => onNavigate(recommendation.orderHref)}
            className="min-h-10 rounded-lg bg-primary px-3 py-2 text-dashboard-action font-bold text-white transition-colors hover:bg-primary-light focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {copy.startOrder}
          </button>

          {recommendation.detailHref && (
            <a
              href={recommendation.detailHref}
              onClick={(event) => {
                event.preventDefault();
                onNavigate(recommendation.detailHref as string);
              }}
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-primary/20 bg-white px-3 py-2 text-dashboard-action font-bold text-primary transition-colors hover:bg-primary/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {copy.viewDetails}
            </a>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={resetChooser}
              className="min-h-10 rounded-lg border border-border bg-surface px-3 py-2 text-dashboard-action font-bold text-primary transition-colors hover:border-primary/30 hover:bg-primary/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {copy.chooseAnother}
            </button>
            <button
              type="button"
              onClick={onBackToChat}
              className="min-h-10 rounded-lg border border-border bg-white px-3 py-2 text-dashboard-action font-bold text-primary transition-colors hover:border-primary/30 hover:bg-primary/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {copy.backToChat}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!question) return null;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-dashboard-body text-muted">{copy.intro}</p>
        <h3 className="mt-2 text-dashboard-section font-bold text-primary">
          {question.label}
        </h3>
      </div>

      <div className="grid gap-2" aria-label={question.label}>
        {question.choices.map((choice) => (
          <button
            key={choice.id}
            type="button"
            onClick={() => handleChoice(choice)}
            className="min-h-10 rounded-lg border border-primary/15 bg-surface px-3 py-2 text-left text-dashboard-action font-bold text-primary transition-colors hover:border-primary/30 hover:bg-primary/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {choice.label}
          </button>
        ))}
      </div>

      <div>
        <button
          type="button"
          onClick={onBackToChat}
          className="min-h-10 rounded-lg border border-border bg-white px-3 py-2 text-dashboard-action font-bold text-primary transition-colors hover:border-primary/30 hover:bg-primary/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {copy.backToChat}
        </button>
      </div>
    </div>
  );
}
