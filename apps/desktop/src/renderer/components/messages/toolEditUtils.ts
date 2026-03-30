import type { ParsedToolEditFile } from "./toolParsing";
import { isLikelyDiff } from "./viewerDetection";

export function toolEditFileHasCollapsibleDiff(file: ParsedToolEditFile): boolean {
  return (
    (file.diff !== null && isLikelyDiff("diff", file.diff)) ||
    (file.oldText !== null && file.newText !== null)
  );
}

export function formatToolEditFileSummary(files: ParsedToolEditFile[]): string {
  const addedCount = files.filter((file) => file.changeType === "add").length;
  const changedCount = files.filter((file) => file.changeType === "update").length;
  const deletedCount = files.filter((file) => file.changeType === "delete").length;
  const parts = [
    ...(addedCount > 0 ? [`${addedCount} ${addedCount === 1 ? "file" : "files"} added`] : []),
    ...(changedCount > 0
      ? [`${changedCount} ${changedCount === 1 ? "file" : "files"} changed`]
      : []),
    ...(deletedCount > 0
      ? [`${deletedCount} ${deletedCount === 1 ? "file" : "files"} deleted`]
      : []),
  ];
  if (parts.length > 0) {
    return parts.join(", ");
  }
  return `${files.length} ${files.length === 1 ? "file" : "files"} changed`;
}
