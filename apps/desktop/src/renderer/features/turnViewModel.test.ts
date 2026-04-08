import { describe, expect, it } from "vitest";

import type { MessageCategory } from "@codetrail/core/browser";

import { buildTurnCategoryCounts, buildTurnVisibleMessages } from "./turnViewModel";

type StubMessage = {
  id: string;
  category: MessageCategory;
};

describe("turnViewModel", () => {
  it("keeps the anchor user message first even when query-filtered turn messages exclude it", () => {
    const anchorMessage: StubMessage = { id: "message_1", category: "user" };
    const messages: StubMessage[] = [
      { id: "message_3", category: "assistant" },
      { id: "message_2", category: "tool_edit" },
    ];

    expect(
      buildTurnVisibleMessages(
        messages,
        anchorMessage,
        ["user", "assistant", "tool_edit"],
        ["message_3"],
      ),
    ).toEqual([anchorMessage, messages[0]]);
  });

  it("omits the anchor row when the user category is hidden", () => {
    const anchorMessage: StubMessage = { id: "message_1", category: "user" };
    const messages: StubMessage[] = [{ id: "message_2", category: "assistant" }];

    expect(buildTurnVisibleMessages(messages, anchorMessage, ["assistant"])).toEqual(messages);
  });

  it("counts the anchor user message even when it is not present in the filtered turn payload", () => {
    const anchorMessage: StubMessage = { id: "message_1", category: "user" };
    const messages: StubMessage[] = [
      { id: "message_2", category: "assistant" },
      { id: "message_3", category: "tool_edit" },
    ];

    expect(buildTurnCategoryCounts(messages, anchorMessage)).toMatchObject({
      user: 1,
      assistant: 1,
      tool_edit: 1,
    });
  });

  it("shows only matched non-anchor messages when search matches are provided", () => {
    const anchorMessage: StubMessage = { id: "message_1", category: "user" };
    const messages: StubMessage[] = [
      anchorMessage,
      { id: "message_2", category: "assistant" },
      { id: "message_3", category: "tool_edit" },
    ];

    expect(
      buildTurnVisibleMessages(
        messages,
        anchorMessage,
        ["user", "assistant", "tool_edit"],
        ["message_3"],
      ),
    ).toEqual([anchorMessage, messages[2]]);
  });

  it("shows only the structural anchor row when search has zero matches", () => {
    const anchorMessage: StubMessage = { id: "message_1", category: "user" };
    const messages: StubMessage[] = [
      anchorMessage,
      { id: "message_2", category: "assistant" },
      { id: "message_3", category: "tool_edit" },
    ];

    expect(
      buildTurnVisibleMessages(messages, anchorMessage, ["user", "assistant", "tool_edit"], []),
    ).toEqual([anchorMessage]);
  });
});
