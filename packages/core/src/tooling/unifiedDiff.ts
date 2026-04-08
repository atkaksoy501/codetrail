type LineOperation = {
  type: "equal" | "remove" | "add";
  line: string;
  oldLine: number;
  newLine: number;
};

type DiffHunk = {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: string[];
};

export function buildUnifiedDiffFromTextPair(args: {
  oldText: string;
  newText: string;
  filePath: string | null;
}): string {
  const oldLines = args.oldText.split(/\r?\n/);
  const newLines = args.newText.split(/\r?\n/);
  const operations = buildLineOperations(oldLines, newLines);
  const hunks = buildDiffHunks(operations, 2);
  const headerFile = args.filePath ?? "file";
  const output: string[] = [`--- a/${headerFile}`, `+++ b/${headerFile}`];
  if (hunks.length === 0) {
    output.push("@@ -1,0 +1,0 @@");
    return output.join("\n");
  }

  for (const hunk of hunks) {
    output.push(
      `@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@`,
      ...hunk.lines,
    );
  }
  return output.join("\n");
}

export function countUnifiedDiffLines(diff: string | null): {
  addedLineCount: number;
  removedLineCount: number;
} {
  if (!diff) {
    return { addedLineCount: 0, removedLineCount: 0 };
  }

  return diff.split("\n").reduce(
    (counts, line) => {
      if (line.startsWith("+++ ") || line.startsWith("--- ")) {
        return counts;
      }
      if (line.startsWith("+")) {
        counts.addedLineCount += 1;
      } else if (line.startsWith("-")) {
        counts.removedLineCount += 1;
      }
      return counts;
    },
    { addedLineCount: 0, removedLineCount: 0 },
  );
}

function buildLineOperations(oldLines: string[], newLines: string[]): LineOperation[] {
  const matrix: number[][] = Array.from({ length: oldLines.length + 1 }, () =>
    Array.from({ length: newLines.length + 1 }, () => 0),
  );

  for (let i = oldLines.length - 1; i >= 0; i -= 1) {
    for (let j = newLines.length - 1; j >= 0; j -= 1) {
      const currentRow = matrix[i];
      if (!currentRow) {
        continue;
      }
      if ((oldLines[i] ?? "") === (newLines[j] ?? "")) {
        currentRow[j] = (matrix[i + 1]?.[j + 1] ?? 0) + 1;
      } else {
        currentRow[j] = Math.max(matrix[i + 1]?.[j] ?? 0, currentRow[j + 1] ?? 0);
      }
    }
  }

  const operations: LineOperation[] = [];
  let i = 0;
  let j = 0;
  let oldLine = 1;
  let newLine = 1;

  while (i < oldLines.length && j < newLines.length) {
    const left = oldLines[i] ?? "";
    const right = newLines[j] ?? "";
    if (left === right) {
      operations.push({ type: "equal", line: left, oldLine, newLine });
      i += 1;
      j += 1;
      oldLine += 1;
      newLine += 1;
      continue;
    }

    if ((matrix[i + 1]?.[j] ?? 0) >= (matrix[i]?.[j + 1] ?? 0)) {
      operations.push({ type: "remove", line: left, oldLine, newLine: 0 });
      i += 1;
      oldLine += 1;
    } else {
      operations.push({ type: "add", line: right, oldLine: 0, newLine });
      j += 1;
      newLine += 1;
    }
  }

  while (i < oldLines.length) {
    operations.push({ type: "remove", line: oldLines[i] ?? "", oldLine, newLine: 0 });
    i += 1;
    oldLine += 1;
  }

  while (j < newLines.length) {
    operations.push({ type: "add", line: newLines[j] ?? "", oldLine: 0, newLine });
    j += 1;
    newLine += 1;
  }

  return operations;
}

function buildDiffHunks(operations: LineOperation[], contextLines: number): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  let index = 0;

  while (index < operations.length) {
    while (index < operations.length && operations[index]?.type === "equal") {
      index += 1;
    }
    if (index >= operations.length) {
      break;
    }

    const hunkStart = Math.max(0, index - contextLines);
    let hunkEnd = index;
    let trailingEquals = 0;
    while (hunkEnd < operations.length) {
      const operation = operations[hunkEnd];
      hunkEnd += 1;
      if (operation?.type === "equal") {
        trailingEquals += 1;
        if (trailingEquals > contextLines) {
          hunkEnd -= trailingEquals - contextLines;
          break;
        }
      } else {
        trailingEquals = 0;
      }
    }

    const slice = operations.slice(hunkStart, hunkEnd);
    const oldStartOperation = slice.find((operation) => operation.oldLine > 0);
    const newStartOperation = slice.find((operation) => operation.newLine > 0);
    const oldStart = oldStartOperation?.oldLine ?? Math.max(1, slice[0]?.oldLine ?? 1);
    const newStart = newStartOperation?.newLine ?? Math.max(1, slice[0]?.newLine ?? 1);
    const oldCount = slice.reduce(
      (count, operation) => count + (operation.type === "add" ? 0 : 1),
      0,
    );
    const newCount = slice.reduce(
      (count, operation) => count + (operation.type === "remove" ? 0 : 1),
      0,
    );
    hunks.push({
      oldStart,
      oldCount,
      newStart,
      newCount,
      lines: slice.map((operation) => {
        if (operation.type === "equal") {
          return ` ${operation.line}`;
        }
        if (operation.type === "remove") {
          return `-${operation.line}`;
        }
        return `+${operation.line}`;
      }),
    });

    index = hunkEnd;
  }

  return hunks;
}
