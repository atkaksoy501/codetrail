// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useHistoryPanePreferences } from "./useHistoryPanePreferences";

describe("useHistoryPanePreferences", () => {
  it("hydrates the updated flat and turn defaults when pane state is unset", () => {
    const { result } = renderHook(() =>
      useHistoryPanePreferences({
        initialPaneState: null,
        isHistoryLayout: true,
        enabledProviders: ["claude", "codex", "gemini", "cursor", "copilot"],
      }),
    );

    expect(result.current.historyCategories).toEqual([
      "user",
      "assistant",
      "tool_use",
      "tool_edit",
      "tool_result",
    ]);
    expect(result.current.expandedByDefaultCategories).toEqual(["user", "assistant"]);
    expect(result.current.turnViewCategories).toEqual(["user", "assistant", "tool_use"]);
    expect(result.current.turnViewExpandedByDefaultCategories).toEqual(["assistant"]);
    expect(result.current.turnViewCombinedChangesExpanded).toBe(true);
  });
});
