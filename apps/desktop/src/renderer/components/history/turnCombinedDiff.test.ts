import { describe, expect, it } from "vitest";

import { type TurnCombinedMessage, aggregateTurnCombinedFiles } from "./turnCombinedDiff";

let codexMessageCounter = 0;

function createCodexPatchMessage(patch: string): TurnCombinedMessage {
  codexMessageCounter += 1;
  return {
    id: `message_${codexMessageCounter}`,
    provider: "codex",
    category: "tool_edit",
    content: JSON.stringify({
      name: "apply_patch",
      input: patch,
    }),
    createdAt: `2026-04-08T08:00:${String(codexMessageCounter).padStart(2, "0")}.000Z`,
  };
}

describe("aggregateTurnCombinedFiles", () => {
  it("keeps disjoint Codex apply_patch edits for the same file", () => {
    const messages = [
      createCodexPatchMessage(
        [
          "*** Begin Patch",
          "*** Update File: src/useHistoryController.ts",
          "@@",
          ' import { useHistoryViewportEffects } from "./useHistoryViewportEffects";',
          '+import { buildTurnCategoryCounts, buildTurnVisibleMessages } from "./turnViewModel";',
          "*** End Patch",
        ].join("\n"),
      ),
      createCodexPatchMessage(
        [
          "*** Begin Patch",
          "*** Update File: src/useHistoryController.ts",
          "@@",
          "   const activeHistoryMessageIds = useMemo(",
          "     () => activeHistoryMessages.map((message) => message.id),",
          "     [activeHistoryMessages],",
          "   );",
          "+  const detailMessages =",
          '+    historyDetailMode === "turn" ? turnVisibleMessages : activeHistoryMessages;',
          "*** End Patch",
        ].join("\n"),
      ),
    ];

    const [file] = aggregateTurnCombinedFiles(messages);

    expect(file).toBeDefined();
    expect(file?.filePath).toBe("src/useHistoryController.ts");
    expect(file?.combinedUnifiedDiff).toContain(
      'import { buildTurnCategoryCounts, buildTurnVisibleMessages } from "./turnViewModel";',
    );
    expect(file?.combinedUnifiedDiff).toContain(
      'historyDetailMode === "turn" ? turnVisibleMessages : activeHistoryMessages;',
    );
    expect(file?.combinedUnifiedDiff?.match(/^@@/gm)).toHaveLength(2);
    expect(file?.combinedUnifiedDiff).toContain("@@ -1,1 +1,2 @@");
    expect(file?.exactness).toBe("best_effort_combined");
    expect(file?.defaultRepresentation).toBe("combined");
  });

  it("replaces earlier Codex apply_patch hunks when a later patch touches the same region", () => {
    const messages = [
      createCodexPatchMessage(
        [
          "*** Begin Patch",
          "*** Update File: src/controller.ts",
          "@@",
          " function loadValue() {",
          '-  return "old";',
          '+  return "mid";',
          " }",
          "*** End Patch",
        ].join("\n"),
      ),
      createCodexPatchMessage(
        [
          "*** Begin Patch",
          "*** Update File: src/controller.ts",
          "@@",
          " function loadValue() {",
          '-  return "mid";',
          '+  return "new";',
          " }",
          "*** End Patch",
        ].join("\n"),
      ),
    ];

    const [file] = aggregateTurnCombinedFiles(messages);

    expect(file?.combinedUnifiedDiff).toContain('+  return "new";');
    expect(file?.combinedUnifiedDiff).not.toContain('+  return "mid";');
    expect(file?.combinedUnifiedDiff?.match(/^@@/gm)).toHaveLength(1);
    expect(file?.combinedUnifiedDiff).toContain("@@ -1,3 +1,3 @@");
    expect(file?.exactness).toBe("best_effort_sequence");
    expect(file?.defaultRepresentation).toBe("sequence");
  });

  it("preserves Codex add-file diffs as full added content", () => {
    const messages = [
      createCodexPatchMessage(
        [
          "*** Begin Patch",
          "*** Add File: src/new-file.ts",
          "+export const created = true;",
          "+export const ready = true;",
          "*** End Patch",
        ].join("\n"),
      ),
    ];

    const [file] = aggregateTurnCombinedFiles(messages);

    expect(file?.changeType).toBe("add");
    expect(file?.combinedUnifiedDiff).toContain("+++ b/src/new-file.ts");
    expect(file?.combinedUnifiedDiff).toContain("+export const created = true;");
    expect(file?.combinedUnifiedDiff).toContain("+export const ready = true;");
    expect(file?.exactness).toBe("exact");
  });

  it("preserves Codex move metadata for combined diffs", () => {
    const messages = [
      createCodexPatchMessage(
        [
          "*** Begin Patch",
          "*** Update File: src/old-name.ts",
          "*** Move to: src/new-name.ts",
          "@@",
          "-export const oldName = true;",
          "+export const newName = true;",
          "*** End Patch",
        ].join("\n"),
      ),
    ];

    const [file] = aggregateTurnCombinedFiles(messages);

    expect(file?.filePath).toBe("src/new-name.ts");
    expect(file?.previousFilePath).toBe("src/old-name.ts");
    expect(file?.changeType).toBe("move");
    expect(file?.combinedUnifiedDiff).toContain("+++ b/src/new-name.ts");
  });

  it("preserves Codex delete-file diffs", () => {
    const messages = [
      createCodexPatchMessage(
        [
          "*** Begin Patch",
          "*** Delete File: src/obsolete.ts",
          "@@",
          "-export const obsolete = true;",
          "*** End Patch",
        ].join("\n"),
      ),
    ];

    const [file] = aggregateTurnCombinedFiles(messages);

    expect(file?.changeType).toBe("delete");
    expect(file?.combinedUnifiedDiff).toContain("+++ /dev/null");
    expect(file?.combinedUnifiedDiff).toContain("-export const obsolete = true;");
  });

  it("builds a valid best-effort delete diff when only the final delete is known", () => {
    const messages: TurnCombinedMessage[] = [
      {
        id: "message_1",
        provider: "claude",
        category: "tool_edit",
        content:
          '{"name":"Edit","input":{"file_path":"src/obsolete.ts","old_string":"before","new_string":"after"}}',
        createdAt: "2026-04-08T08:00:00.000Z",
        toolEditFiles: [
          {
            filePath: "src/obsolete.ts",
            previousFilePath: null,
            changeType: "update",
            unifiedDiff:
              "--- a/src/obsolete.ts\n+++ b/src/obsolete.ts\n@@ -1,1 +1,1 @@\n-before\n+after",
            addedLineCount: 1,
            removedLineCount: 1,
            exactness: "best_effort",
          },
        ],
      },
      {
        id: "message_2",
        provider: "claude",
        category: "tool_edit",
        content: '{"name":"Delete","input":{"file_path":"src/obsolete.ts"}}',
        createdAt: "2026-04-08T08:01:00.000Z",
        toolEditFiles: [
          {
            filePath: "src/obsolete.ts",
            previousFilePath: null,
            changeType: "delete",
            unifiedDiff: null,
            addedLineCount: 0,
            removedLineCount: 0,
            exactness: "best_effort",
          },
        ],
      },
    ];

    const [file] = aggregateTurnCombinedFiles(messages);

    expect(file?.changeType).toBe("delete");
    expect(file?.combinedUnifiedDiff).toContain("@@ -1,1 +0,0 @@");
    expect(file?.combinedUnifiedDiff).toContain("-[deleted]");
    expect(file?.defaultRepresentation).toBe("sequence");
  });

  it("filters out Claude internal artifact files from combined changes", () => {
    const messages: TurnCombinedMessage[] = [
      {
        id: "message_1",
        provider: "claude",
        category: "tool_edit",
        content:
          '{"name":"Write","input":{"file_path":"/Users/test/.claude/projects/foo/tool-results/bar.txt"}}',
        createdAt: "2026-04-08T08:00:00.000Z",
        toolEditFiles: [
          {
            filePath: "/Users/test/.claude/projects/foo/tool-results/bar.txt",
            previousFilePath: null,
            changeType: "add",
            unifiedDiff:
              "--- a//Users/test/.claude/projects/foo/tool-results/bar.txt\n+++ b//Users/test/.claude/projects/foo/tool-results/bar.txt\n@@ -0,0 +1,1 @@\n+artifact",
            addedLineCount: 1,
            removedLineCount: 0,
            exactness: "best_effort",
          },
          {
            filePath: "/workspace/project-one/src/query.ts",
            previousFilePath: null,
            changeType: "update",
            unifiedDiff:
              "--- a//workspace/project-one/src/query.ts\n+++ b//workspace/project-one/src/query.ts\n@@ -1,1 +1,1 @@\n-old\n+new",
            addedLineCount: 1,
            removedLineCount: 1,
            exactness: "exact",
          },
        ],
      },
    ];

    const files = aggregateTurnCombinedFiles(messages);

    expect(files).toHaveLength(1);
    expect(files[0]?.filePath).toBe("/workspace/project-one/src/query.ts");
  });

  it("ignores tool_result diff output and only keeps true writes", () => {
    const messages: TurnCombinedMessage[] = [
      {
        id: "message_1",
        provider: "claude",
        category: "tool_use",
        content: JSON.stringify({
          type: "tool_use",
          name: "Read",
          input: {
            file_path: "/Users/test/.claude/projects/foo/tool-results/diff.txt",
          },
        }),
        createdAt: "2026-04-08T08:00:00.000Z",
      },
      {
        id: "message_2",
        provider: "claude",
        category: "tool_result",
        content: [
          "1\tdiff --git a/apps/desktop/src/main/data/bookmarkStore.ts b/apps/desktop/src/main/data/bookmarkStore.ts",
          "2\tindex 1111111..2222222 100644",
          "3\t--- a/apps/desktop/src/main/data/bookmarkStore.ts",
          "4\t+++ b/apps/desktop/src/main/data/bookmarkStore.ts",
          "5\t@@ -1,2 +1,3 @@",
          "6\t export function loadBookmarks() {",
          "7\t+  return 1;",
          "8\t }",
        ].join("\n"),
        createdAt: "2026-04-08T08:00:01.000Z",
      },
    ];

    const [file] = aggregateTurnCombinedFiles(messages);

    expect(file).toBeUndefined();
  });

  it("ignores non-write Read tool paths when no diff output exists", () => {
    const messages: TurnCombinedMessage[] = [
      {
        id: "message_1",
        provider: "claude",
        category: "tool_use",
        content: JSON.stringify({
          type: "tool_use",
          name: "Read",
          input: {
            file_path: "/workspace/project-one/src/query.ts",
          },
        }),
        createdAt: "2026-04-08T08:00:00.000Z",
      },
      {
        id: "message_2",
        provider: "claude",
        category: "tool_result",
        content: "Some plain file contents without unified diff markers.",
        createdAt: "2026-04-08T08:00:01.000Z",
      },
    ];

    const files = aggregateTurnCombinedFiles(messages);

    expect(files).toEqual([]);
  });

  it("drops write artifacts that do not have a renderable diff", () => {
    const messages: TurnCombinedMessage[] = [
      {
        id: "message_1",
        provider: "claude",
        category: "tool_edit",
        content: "opaque write payload without replayable diff context",
        createdAt: "2026-04-08T08:00:00.000Z",
        toolEditFiles: [
          {
            filePath: "src/query.ts",
            previousFilePath: null,
            changeType: "update",
            unifiedDiff: null,
            addedLineCount: 0,
            removedLineCount: 0,
            exactness: "best_effort",
          },
        ],
      },
    ];

    expect(aggregateTurnCombinedFiles(messages)).toEqual([]);
  });

  it("keeps synthesized delete diffs renderable in combined changes", () => {
    const messages: TurnCombinedMessage[] = [
      {
        id: "message_1",
        provider: "claude",
        category: "tool_edit",
        content: '{"name":"Delete","input":{"file_path":"src/query.ts"}}',
        createdAt: "2026-04-08T08:00:00.000Z",
        toolEditFiles: [
          {
            filePath: "src/query.ts",
            previousFilePath: null,
            changeType: "delete",
            unifiedDiff: null,
            addedLineCount: 0,
            removedLineCount: 0,
            exactness: "best_effort",
          },
        ],
      },
    ];

    const [file] = aggregateTurnCombinedFiles(messages);
    expect(file?.changeType).toBe("delete");
    expect(file?.combinedUnifiedDiff).toContain("+++ /dev/null");
  });
});
