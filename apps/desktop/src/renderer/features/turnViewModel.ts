import type { MessageCategory } from "@codetrail/core/browser";

import { EMPTY_CATEGORY_COUNTS } from "../app/constants";

type TurnMessageLike = {
  id: string;
  category: MessageCategory;
};

export function buildTurnVisibleMessages<T extends TurnMessageLike>(
  messages: T[],
  anchorMessage: T | null,
  enabledCategories: readonly MessageCategory[],
  matchedMessageIds?: readonly string[] | null,
): T[] {
  const enabledCategorySet = new Set(enabledCategories);
  const matchedMessageIdSet =
    matchedMessageIds === undefined || matchedMessageIds === null
      ? null
      : new Set(matchedMessageIds);
  const visibleMessages = messages.filter(
    (message) =>
      enabledCategorySet.has(message.category) &&
      (matchedMessageIdSet === null || matchedMessageIdSet.has(message.id)),
  );
  if (!anchorMessage || !enabledCategorySet.has(anchorMessage.category)) {
    return visibleMessages;
  }
  const otherMessages = visibleMessages.filter((message) => message.id !== anchorMessage.id);
  return [anchorMessage, ...otherMessages];
}

export function buildTurnCategoryCounts<T extends TurnMessageLike>(
  messages: T[],
  anchorMessage: T | null,
) {
  const counts = { ...EMPTY_CATEGORY_COUNTS };
  const countedMessages =
    anchorMessage && !messages.some((message) => message.id === anchorMessage.id)
      ? [anchorMessage, ...messages]
      : messages;
  for (const message of countedMessages) {
    counts[message.category] += 1;
  }
  return counts;
}
