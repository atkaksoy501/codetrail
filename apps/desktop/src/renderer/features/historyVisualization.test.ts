import { describe, expect, it } from "vitest";

import { deriveInitialHistoryVisualization } from "./historyVisualization";

describe("deriveInitialHistoryVisualization", () => {
  it("defaults to Flat when pane state does not specify a history view", () => {
    expect(deriveInitialHistoryVisualization(null)).toBe("messages");
    expect(deriveInitialHistoryVisualization(undefined)).toBe("messages");
    expect(deriveInitialHistoryVisualization({} as never)).toBe("messages");
  });

  it("preserves legacy flat and bookmarks pane state hydration", () => {
    expect(
      deriveInitialHistoryVisualization({
        historyMode: "session",
        historyDetailMode: "flat",
      } as never),
    ).toBe("messages");
    expect(
      deriveInitialHistoryVisualization({
        historyMode: "bookmarks",
        historyDetailMode: "flat",
      } as never),
    ).toBe("bookmarks");
  });
});
