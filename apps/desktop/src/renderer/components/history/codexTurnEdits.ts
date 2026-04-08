import { type ParsedToolEditFile, buildUnifiedDiffFromTextPair } from "../../../shared/toolParsing";
import { parseMessageToolPayload } from "../messages/messageToolPayload";
import {
  type TurnCombinedSourceMessage,
  type TurnSequenceEdit,
  countDiffLines,
  ensureRenderableCombinedDiff,
} from "./turnCombinedModel";

export function collectCodexTurnEdits(messages: TurnCombinedSourceMessage[]): TurnSequenceEdit[] {
  const edits: TurnSequenceEdit[] = [];

  for (const message of messages) {
    if (message.provider !== "codex") {
      continue;
    }
    const payload = parseMessageToolPayload(message.category as never, message.content);
    if (!payload.toolInvocation?.isWrite) {
      continue;
    }
    for (const [index, parsedFile] of (payload.toolEdit?.files ?? []).entries()) {
      const step = mapParsedFileToSequenceEdit(message, parsedFile, index);
      if (step) {
        edits.push(step);
      }
    }
  }

  return edits;
}

function mapParsedFileToSequenceEdit(
  message: TurnCombinedSourceMessage,
  file: ParsedToolEditFile,
  fileIndex: number,
): TurnSequenceEdit | null {
  const unifiedDiff =
    file.diff ??
    (file.oldText !== null || file.newText !== null
      ? buildUnifiedDiffFromTextPair({
          oldText: file.oldText ?? "",
          newText: file.newText ?? "",
          filePath: file.filePath,
        })
      : null);
  const counts = countDiffLines(unifiedDiff);
  const renderable = ensureRenderableCombinedDiff({
    filePath: file.filePath,
    previousFilePath: file.previousFilePath ?? null,
    changeType: file.changeType,
    unifiedDiff,
    addedLineCount: counts.added,
    removedLineCount: counts.removed,
    exactness: unifiedDiff ? "exact" : "best_effort",
  });
  if (!renderable) {
    return null;
  }
  return {
    key: `${message.id}:${fileIndex}:${renderable.filePath}`,
    messageId: message.id,
    createdAt: message.createdAt,
    provider: message.provider,
    filePath: renderable.filePath,
    previousFilePath: renderable.previousFilePath,
    changeType: renderable.changeType,
    unifiedDiff: renderable.unifiedDiff,
    addedLineCount: renderable.addedLineCount,
    removedLineCount: renderable.removedLineCount,
    exactness: renderable.exactness,
  };
}
