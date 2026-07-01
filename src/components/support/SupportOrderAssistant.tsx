"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ORDER_ASSISTANT_INITIAL_QUESTION_ID,
  getLocalizedOrderAssistantRecommendation,
  getOrderAssistantQuestion,
  orderAssistantCopy,
  type LocalizedOrderAssistantChoice,
  type OrderAssistantGoalId,
  type OrderAssistantQuestionId,
} from "@/components/support/support-order-assistant";
import type { SupportChatLanguage } from "@/components/support/support-chat-copy";

interface SupportOrderAssistantProps {
  language: SupportChatLanguage;
  onNavigate: (href: string) => void;
  onBackToChat: () => void;
}

interface RecommendationRequest {
  goalId: OrderAssistantGoalId;
  answerId?: OrderAssistantGoalId;
}

export default function SupportOrderAssistant({
  language,
  onNavigate,
  onBackToChat,
}: SupportOrderAssistantProps) {
  const copy = orderAssistantCopy[language];
  const [questionId, setQuestionId] = useState<OrderAssistantQuestionId>(
    ORDER_ASSISTANT_INITIAL_QUESTION_ID,
  );
  const [parentGoalId, setParentGoalId] = useState<OrderAssistantGoalId | null>(
    null,
  );
  const [recommendationRequest, setRecommendationRequest] =
    useState<RecommendationRequest | null>(null);
  const recommendationHeadingRef = useRef<HTMLHeadingElement | null>(null);

  const question = useMemo(
    () => getOrderAssistantQuestion(language, questionId),
    [language, questionId],
  );
  const recommendation = recommendationRequest
    ? getLocalizedOrderAssistantRecommendation(
        language,
        recommendationRequest.goalId,
        recommendationRequest.answerId,
      )
    : null;

  useEffect(() => {
    if (!recommendation) return;
    window.setTimeout(() => recommendationHeadingRef.current?.focus(), 0);
  }, [recommendation]);

  const resetChooser = () => {
    setQuestionId(ORDER_ASSISTANT_INITIAL_QUESTION_ID);
    setParentGoalId(null);
    setRecommendationRequest(null);
  };

  const handleChoice = (choice: LocalizedOrderAssistantChoice) => {
    if (choice.nextQuestionId) {
      setParentGoalId(choice.id);
      setQuestionId(choice.nextQuestionId);
      setRecommendationRequest(null);
      return;
    }

    setRecommendationRequest({
      goalId: parentGoalId ?? choice.id,
      answerId: parentGoalId ? choice.id : undefined,
    });
  };

  const goBack = () => {
    if (questionId === ORDER_ASSISTANT_INITIAL_QUESTION_ID) {
      onBackToChat();
      return;
    }

    setQuestionId(ORDER_ASSISTANT_INITIAL_QUESTION_ID);
    setParentGoalId(null);
    setRecommendationRequest(null);
  };

  if (recommendation) {
    return (
      <div className="space-y-3" aria-live="polite">
        <div className="rounded-xl border border-primary/15 bg-primary/5 p-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-secondary-dark">
            {copy.recommendedHeading}
          </p>
          <h3
            ref={recommendationHeadingRef}
            tabIndex={-1}
            className="mt-1 text-base font-bold text-primary focus:outline-none"
          >
            {recommendation.label}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {recommendation.reason}
          </p>
        </div>

        <div className="grid gap-2">
          <button
            type="button"
            onClick={() => onNavigate(recommendation.orderHref)}
            className="min-h-10 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-light focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm font-bold text-primary transition-colors hover:bg-primary/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {copy.viewDetails}
            </a>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={resetChooser}
              className="min-h-10 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-bold text-primary transition-colors hover:border-primary/30 hover:bg-primary/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {copy.chooseAnother}
            </button>
            <button
              type="button"
              onClick={onBackToChat}
              className="min-h-10 rounded-lg border border-border bg-white px-3 py-2 text-sm font-bold text-primary transition-colors hover:border-primary/30 hover:bg-primary/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
        <p className="text-sm leading-relaxed text-muted">{copy.intro}</p>
        <h3 className="mt-2 text-sm font-bold text-primary">
          {question.label}
        </h3>
      </div>

      <div className="grid gap-2" role="list" aria-label={question.label}>
        {question.choices.map((choice) => (
          <button
            key={choice.id}
            type="button"
            onClick={() => handleChoice(choice)}
            className="min-h-10 rounded-lg border border-primary/15 bg-surface px-3 py-2 text-left text-sm font-bold leading-snug text-primary transition-colors hover:border-primary/30 hover:bg-primary/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {choice.label}
          </button>
        ))}
      </div>

      <div>
        <button
          type="button"
          onClick={goBack}
          className="min-h-10 rounded-lg border border-border bg-white px-3 py-2 text-sm font-bold text-primary transition-colors hover:border-primary/30 hover:bg-primary/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {questionId === ORDER_ASSISTANT_INITIAL_QUESTION_ID
            ? copy.backToChat
            : copy.back}
        </button>
      </div>
    </div>
  );
}
