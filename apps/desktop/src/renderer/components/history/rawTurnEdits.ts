import { type Provider, getProviderLabel, normalizeMessageCategory } from "@codetrail/core/browser";

import { type ParsedToolEditFile, buildUnifiedDiffFromTextPair } from "../../../shared/toolParsing";
import { parseMessageToolPayload } from "../messages/messageToolPayload";
import {
  type TurnCombinedSourceMessage,
  type TurnSequenceEdit,
  countDiffLines,
  ensureRenderableCombinedDiff,
  isInternalAssistantArtifactPath,
} from "./turnCombinedModel";

type RawCollectorOptions = {
  providers: readonly Provider[];
  allowTouchedFileFallback?: boolean;
};

export function collectRawTurnEdits(
  messages: TurnCombinedSourceMessage[],
  options: RawCollectorOptions,
): TurnSequenceEdit[] {
  const providerSet = new Set(options.providers);
  const edits: TurnSequenceEdit[] = [];

  for (const message of messages) {
    if (!providerSet.has(message.provider)) {
      continue;
    }
    const payload = parseMessageToolPayload(
      normalizeMessageCategory(message.category),
      message.content,
    );
    if (!payload.toolInvocation?.isWrite) {
      continue;
    }
    for (const [index, parsedFile] of (payload.toolEdit?.files ?? []).entries()) {
      const step = mapParsedFileToSequenceEdit(message, parsedFile, index, options);
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
  options: RawCollectorOptions,
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
  const exactness = unifiedDiff ? "exact" : "best_effort";
  const renderable = ensureRenderableCombinedDiff({
    filePath: file.filePath,
    previousFilePath: file.previousFilePath ?? null,
    changeType: file.changeType,
    unifiedDiff,
    addedLineCount: counts.added,
    removedLineCount: counts.removed,
    exactness,
  });
  if (renderable) {
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

  if (!options.allowTouchedFileFallback || isInternalAssistantArtifactPath(file.filePath)) {
    return null;
  }

  return {
    key: `${message.id}:${fileIndex}:${file.filePath}`,
    messageId: message.id,
    createdAt: message.createdAt,
    provider: message.provider,
    filePath: file.filePath,
    previousFilePath: file.previousFilePath ?? null,
    changeType: file.changeType,
    unifiedDiff: buildTouchedFileFallbackText(file, message.provider),
    addedLineCount: 0,
    removedLineCount: 0,
    exactness: "best_effort",
  };
}

function buildTouchedFileFallbackText(file: ParsedToolEditFile, provider: Provider): string {
  const action =
    file.changeType === "add"
      ? "Created file"
      : file.changeType === "delete"
        ? "Deleted file"
        : file.previousFilePath && file.previousFilePath !== file.filePath
          ? `Renamed file from ${file.previousFilePath}`
          : "Updated file";
  return `${action} via ${getProviderLabel(provider)}. Exact diff unavailable in session payload.`;
}
