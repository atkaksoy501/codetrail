import type { MessageCategory } from "@codetrail/core/browser";

import { collectClaudeTurnEdits } from "./claudeTurnEdits";
import { collectCodexTurnEdits } from "./codexTurnEdits";
import {
  type TurnCombinedExactness,
  type TurnCombinedFile,
  type TurnCombinedSourceMessage,
  type TurnSequenceEdit,
  countDiffLines,
  representationFromExactness,
} from "./turnCombinedModel";
import { mergeUnifiedDiffs } from "./turnCombinedUtils";

export type TurnCombinedMessage = TurnCombinedSourceMessage & {
  category: MessageCategory;
};

export function aggregateTurnCombinedFiles(messages: TurnCombinedMessage[]): TurnCombinedFile[] {
  const grouped = groupEditsByFile(
    [...collectClaudeTurnEdits(messages), ...collectCodexTurnEdits(messages)].sort(
      (left, right) =>
        left.createdAt.localeCompare(right.createdAt) ||
        left.messageId.localeCompare(right.messageId) ||
        left.key.localeCompare(right.key),
    ),
  );

  return Array.from(grouped.values())
    .map((steps) => aggregateFileSteps(steps))
    .sort((left, right) => left.filePath.localeCompare(right.filePath));
}

function groupEditsByFile(edits: TurnSequenceEdit[]): Map<string, TurnSequenceEdit[]> {
  const groups = new Map<string, TurnSequenceEdit[]>();

  for (const edit of edits) {
    const currentKey = groups.has(edit.filePath)
      ? edit.filePath
      : edit.previousFilePath && groups.has(edit.previousFilePath)
        ? edit.previousFilePath
        : edit.filePath;
    const steps = groups.get(currentKey) ?? [];
    steps.push(edit);
    if (currentKey !== edit.filePath) {
      groups.delete(currentKey);
      groups.set(edit.filePath, steps);
    } else {
      groups.set(currentKey, steps);
    }
  }

  return groups;
}

function aggregateFileSteps(steps: TurnSequenceEdit[]): TurnCombinedFile {
  if (steps.some((step) => step.provider === "claude")) {
    return aggregateClaudeFileSteps(steps);
  }
  return aggregateCodexFileSteps(steps);
}

function aggregateClaudeFileSteps(steps: TurnSequenceEdit[]): TurnCombinedFile {
  const last = steps.at(-1);
  if (!last) {
    throw new Error("aggregateClaudeFileSteps requires at least one edit step");
  }
  const merged = mergeStepDiffs(steps);
  const hasBestEffortStep = steps.some((step) => step.exactness === "best_effort");
  const hasDeleteChain = steps.length > 1 && steps.some((step) => step.changeType === "delete");
  const exactness: TurnCombinedExactness =
    steps.length === 1
      ? steps[0]?.exactness === "exact"
        ? "exact"
        : "best_effort_combined"
      : !hasBestEffortStep && merged.exact && !merged.overlapping && !hasDeleteChain
        ? "exact"
        : merged.diff && !hasDeleteChain
          ? merged.overlapping
            ? "best_effort_sequence"
            : "best_effort_combined"
          : "best_effort_sequence";
  const counts =
    exactness === "best_effort_sequence"
      ? sumSequenceCounts(steps)
      : countDiffLines(merged.diff ?? steps.at(-1)?.unifiedDiff ?? null);
  return {
    filePath: last.filePath,
    previousFilePath: steps.find((step) => step.previousFilePath)?.previousFilePath ?? null,
    changeType: last.changeType,
    exactness,
    defaultRepresentation: representationFromExactness(exactness),
    combinedUnifiedDiff: merged.diff ?? steps.at(-1)?.unifiedDiff ?? null,
    addedLineCount: counts.added,
    removedLineCount: counts.removed,
    sequenceEdits: steps,
  };
}

function aggregateCodexFileSteps(steps: TurnSequenceEdit[]): TurnCombinedFile {
  const last = steps.at(-1);
  if (!last) {
    throw new Error("aggregateCodexFileSteps requires at least one edit step");
  }
  const merged = mergeStepDiffs(steps);
  const hasBestEffortStep = steps.some((step) => step.exactness === "best_effort");
  const hasOverlappingRewrite = merged.overlapping;
  const hasDeleteChain = steps.length > 1 && steps.some((step) => step.changeType === "delete");
  const exactness: TurnCombinedExactness =
    steps.length === 1 && steps[0]?.exactness === "exact"
      ? "exact"
      : !hasBestEffortStep && !hasOverlappingRewrite && !hasDeleteChain && merged.diff
        ? "best_effort_combined"
        : "best_effort_sequence";
  const counts =
    exactness === "best_effort_sequence"
      ? sumSequenceCounts(steps)
      : countDiffLines(merged.diff ?? steps.at(-1)?.unifiedDiff ?? null);
  return {
    filePath: last.filePath,
    previousFilePath: steps.find((step) => step.previousFilePath)?.previousFilePath ?? null,
    changeType: last.changeType,
    exactness,
    defaultRepresentation: representationFromExactness(exactness),
    combinedUnifiedDiff: merged.diff ?? steps.at(-1)?.unifiedDiff ?? null,
    addedLineCount: counts.added,
    removedLineCount: counts.removed,
    sequenceEdits: steps,
  };
}

function mergeStepDiffs(steps: TurnSequenceEdit[]): {
  diff: string | null;
  exact: boolean;
  overlapping: boolean;
} {
  let currentDiff: string | null = null;
  let exact = true;
  let overlapping = false;
  for (const step of steps) {
    const merged = mergeUnifiedDiffs(currentDiff, step.unifiedDiff, step.filePath);
    currentDiff = merged.diff;
    exact = exact && merged.exact;
    overlapping = overlapping || merged.overlapping;
  }
  return { diff: currentDiff, exact, overlapping };
}

function sumSequenceCounts(steps: TurnSequenceEdit[]): { added: number; removed: number } {
  return steps.reduce(
    (totals, step) => {
      totals.added += step.addedLineCount;
      totals.removed += step.removedLineCount;
      return totals;
    },
    { added: 0, removed: 0 },
  );
}
