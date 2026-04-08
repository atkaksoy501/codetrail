export type ParsedDiffHunk = {
  oldStart: number | null;
  oldCount: number | null;
  newStart: number | null;
  newCount: number | null;
  lines: string[];
  headerLine: string;
  order: number;
};

export function parseUnifiedDiffHunks(diff: string): ParsedDiffHunk[] {
  const lines = diff.split("\n");
  const hunks: ParsedDiffHunk[] = [];

  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    const match = /^@@(?: -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@)?(?:.*)?$/.exec(line.trim());
    if (!match) {
      index += 1;
      continue;
    }

    const hunkLines: string[] = [];
    index += 1;
    while (index < lines.length) {
      const current = lines[index] ?? "";
      if (current.startsWith("@@")) {
        break;
      }
      if (
        current.startsWith("diff --git") ||
        current.startsWith("index ") ||
        current.startsWith("--- ") ||
        current.startsWith("+++ ")
      ) {
        break;
      }
      hunkLines.push(current);
      index += 1;
    }

    hunks.push({
      oldStart: match[1] ? Number(match[1]) : null,
      oldCount: match[2] ? Number(match[2]) : match[1] ? 1 : null,
      newStart: match[3] ? Number(match[3]) : null,
      newCount: match[4] ? Number(match[4]) : match[3] ? 1 : null,
      lines: hunkLines,
      headerLine: line.trim() || "@@",
      order: hunks.length,
    });
  }

  if (hunks.length === 0) {
    const bodyLines = lines.filter(
      (line) =>
        !line.startsWith("diff --git") &&
        !line.startsWith("index ") &&
        !line.startsWith("--- ") &&
        !line.startsWith("+++ "),
    );
    if (bodyLines.some((line) => /^[ +\-]/.test(line))) {
      hunks.push({
        oldStart: null,
        oldCount: null,
        newStart: null,
        newCount: null,
        lines: bodyLines,
        headerLine: "@@",
        order: 0,
      });
    }
  }

  return hunks;
}

export function mergeUnifiedDiffs(
  currentDiff: string | null,
  nextDiff: string | null,
  filePath: string,
): { diff: string | null; exact: boolean; overlapping: boolean } {
  if (!nextDiff) {
    return { diff: currentDiff, exact: true, overlapping: false };
  }
  if (!currentDiff) {
    return { diff: nextDiff, exact: true, overlapping: false };
  }

  const currentHunks = parseUnifiedDiffHunks(currentDiff);
  const nextHunks = parseUnifiedDiffHunks(nextDiff);
  if (currentHunks.length === 0 || nextHunks.length === 0) {
    return {
      diff: [currentDiff, nextDiff].filter(Boolean).join("\n"),
      exact: false,
      overlapping: true,
    };
  }

  const merged = [...currentHunks];
  let overlapping = false;
  for (const nextHunk of nextHunks) {
    const overlappingIndexes: number[] = [];
    merged.forEach((existing, index) => {
      if (doHunksOverlap(existing, nextHunk)) {
        overlappingIndexes.push(index);
      }
    });
    if (overlappingIndexes.length > 0) {
      overlapping = true;
      for (const index of overlappingIndexes.reverse()) {
        merged.splice(index, 1);
      }
    }
    merged.push(nextHunk);
  }

  if (merged.every((hunk) => hunk.newStart !== null)) {
    merged.sort((left, right) => {
      const leftStart = left.newStart ?? Number.MAX_SAFE_INTEGER;
      const rightStart = right.newStart ?? Number.MAX_SAFE_INTEGER;
      return leftStart - rightStart || left.order - right.order;
    });
  }

  const exact = merged.every(
    (hunk) =>
      hunk.oldStart !== null &&
      hunk.oldCount !== null &&
      hunk.newStart !== null &&
      hunk.newCount !== null &&
      /^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/.test(hunk.headerLine),
  );

  return {
    diff: renderMergedUnifiedDiff(filePath, merged, exact),
    exact,
    overlapping,
  };
}

function renderMergedUnifiedDiff(
  filePath: string,
  hunks: ParsedDiffHunk[],
  exact: boolean,
): string {
  const body = exact ? renderExactMergedHunks(hunks) : renderBestEffortMergedHunks(hunks);
  return [`--- a/${filePath}`, `+++ b/${filePath}`, ...body].join("\n");
}

function renderExactMergedHunks(hunks: ParsedDiffHunk[]): string[] {
  return hunks.flatMap((hunk) => [hunk.headerLine, ...hunk.lines]);
}

function renderBestEffortMergedHunks(hunks: ParsedDiffHunk[]): string[] {
  const lines: string[] = [];
  let oldCursor = 1;
  let newCursor = 1;

  for (const hunk of hunks) {
    const oldCount = hunk.oldCount ?? countHunkOldLines(hunk.lines);
    const newCount = hunk.newCount ?? countHunkNewLines(hunk.lines);
    const oldStart = hunk.oldStart ?? oldCursor;
    const newStart = hunk.newStart ?? newCursor;
    lines.push(`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`);
    lines.push(...hunk.lines);
    oldCursor = oldStart + Math.max(oldCount, 1);
    newCursor = newStart + Math.max(newCount, 1);
  }

  return lines;
}

function countHunkOldLines(lines: string[]): number {
  return lines.filter((line) => !line.startsWith("+")).length;
}

function countHunkNewLines(lines: string[]): number {
  return lines.filter((line) => !line.startsWith("-")).length;
}

export function doHunksOverlap(left: ParsedDiffHunk, right: ParsedDiffHunk): boolean {
  if (
    left.newStart !== null &&
    left.newCount !== null &&
    right.newStart !== null &&
    right.newCount !== null
  ) {
    const leftStart = left.newStart;
    const leftEnd = left.newStart + Math.max(left.newCount, 1);
    const rightStart = right.newStart;
    const rightEnd = right.newStart + Math.max(right.newCount, 1);
    return rightStart < leftEnd && rightEnd > leftStart;
  }

  const leftContextWindows = buildContextWindows(left.lines);
  const rightContextWindows = buildContextWindows(right.lines);
  if (leftContextWindows.size > 0 && rightContextWindows.size > 0) {
    for (const window of leftContextWindows) {
      if (rightContextWindows.has(window)) {
        return true;
      }
    }
  }

  const leftMeaningfulLines = buildMeaningfulLineSet(left.lines);
  const rightMeaningfulLines = buildMeaningfulLineSet(right.lines);
  let shared = 0;
  for (const line of leftMeaningfulLines) {
    if (rightMeaningfulLines.has(line)) {
      shared += 1;
      if (shared >= 2) {
        return true;
      }
    }
  }
  return false;
}

function buildContextWindows(lines: string[]): Set<string> {
  const contextLines = lines
    .filter((line) => line.startsWith(" "))
    .map((line) => normalizeMeaningfulLine(line.slice(1)))
    .filter((line): line is string => line !== null);
  const windows = new Set<string>();
  for (let index = 0; index + 1 < contextLines.length; index += 1) {
    windows.add(`${contextLines[index]}\n${contextLines[index + 1]}`);
  }
  return windows;
}

function buildMeaningfulLineSet(lines: string[]): Set<string> {
  const values = new Set<string>();
  for (const line of lines) {
    if (line.length === 0) {
      continue;
    }
    const normalized = normalizeMeaningfulLine(line.slice(1));
    if (normalized) {
      values.add(normalized);
    }
  }
  return values;
}

function normalizeMeaningfulLine(line: string): string | null {
  const normalized = line.trim().replace(/\s+/g, " ");
  if (
    normalized.length < 8 ||
    normalized === "{" ||
    normalized === "}" ||
    normalized === ");" ||
    normalized === ")," ||
    normalized === "];"
  ) {
    return null;
  }
  return normalized;
}
