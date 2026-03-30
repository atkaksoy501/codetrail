import type { MessageCategory } from "@codetrail/core/browser";
import { useState } from "react";

import { getCodetrailClient } from "../../lib/codetrailClient";
import { openFileInEditor } from "../../lib/pathActions";
import type { ParsedMessageToolPayload } from "./messageToolPayload";
import { parseMessageToolPayload } from "./messageToolPayload";
import {
  CodeBlock,
  DiffBlock,
  buildHighlightedTextNodes,
  detectLanguageFromContent,
  detectLanguageFromFilePath,
  isLikelyDiff,
  looksLikeMarkdown,
  renderPlainText,
  renderRichText,
  tryFormatJson,
  useDocumentCollapseMultiFileToolDiffs,
} from "./textRendering";
import {
  type ParsedToolEditFile,
  asNonEmptyString,
  asObject,
  asString,
  buildUnifiedDiffFromTextPair,
  tryParseJsonRecord,
} from "./toolParsing";
import { trimProjectPrefixFromPath } from "./viewerDiffModel";
import { getPathBaseName } from "./viewerDiffModel";

export function MessageContent({
  text,
  category,
  query,
  highlightPatterns = [],
  pathRoots = [],
  parsedToolPayload,
}: {
  text: string;
  category: MessageCategory;
  query: string;
  highlightPatterns?: string[];
  pathRoots?: string[];
  parsedToolPayload?: ParsedMessageToolPayload;
}) {
  const resolvedParsedToolPayload = parsedToolPayload ?? parseMessageToolPayload(category, text);
  if (category === "thinking") {
    return (
      <pre className="thinking-block">
        {buildHighlightedTextNodes(text, query, "thinking", highlightPatterns)}
      </pre>
    );
  }

  if (category === "tool_edit") {
    return (
      <ToolEditContent
        text={text}
        query={query}
        highlightPatterns={highlightPatterns}
        pathRoots={pathRoots}
        parsedToolPayload={resolvedParsedToolPayload}
      />
    );
  }

  if (category === "tool_use") {
    return (
      <ToolUseContent
        text={text}
        query={query}
        highlightPatterns={highlightPatterns}
        pathRoots={pathRoots}
        parsedToolPayload={resolvedParsedToolPayload}
      />
    );
  }

  if (category === "tool_result") {
    return (
      <ToolResultContent
        text={text}
        query={query}
        highlightPatterns={highlightPatterns}
        parsedToolPayload={resolvedParsedToolPayload}
      />
    );
  }

  if (category === "assistant") {
    const content = looksLikeMarkdown(text)
      ? renderRichText(text, query, "assistant-md", pathRoots, highlightPatterns)
      : renderPlainText(text, query, "assistant-txt", pathRoots, highlightPatterns);
    return <div className="rich-block">{content}</div>;
  }

  const content = looksLikeMarkdown(text)
    ? renderRichText(text, query, "msg-md", pathRoots, highlightPatterns)
    : renderPlainText(text, query, "msg-txt", pathRoots, highlightPatterns);
  return <div className="rich-block">{content}</div>;
}

function ToolUseContent({
  text,
  query,
  highlightPatterns,
  pathRoots,
  parsedToolPayload,
}: {
  text: string;
  query: string;
  highlightPatterns: string[];
  pathRoots: string[];
  parsedToolPayload: ParsedMessageToolPayload;
}) {
  const parsed = parsedToolPayload.toolInvocation;
  if (!parsed) {
    const formatted = tryFormatJson(text);
    return (
      <pre className="tool-block">
        {buildHighlightedTextNodes(formatted, query, "tool-use-raw", highlightPatterns)}
      </pre>
    );
  }

  if (parsed.isWrite) {
    return (
      <ToolEditContent
        text={text}
        query={query}
        highlightPatterns={highlightPatterns}
        pathRoots={pathRoots}
        parsedToolPayload={parsedToolPayload}
      />
    );
  }

  const command = asNonEmptyString(parsed.inputRecord?.cmd ?? parsed.inputRecord?.command);
  const targetPath = asNonEmptyString(
    parsed.inputRecord?.file_path ?? parsed.inputRecord?.path ?? parsed.inputRecord?.file,
  );

  return (
    <div className="tool-use-view">
      {targetPath ? <div className="tool-edit-path">{targetPath}</div> : null}
      {command ? (
        <div className="tool-use-section">
          <div className="tool-use-section-label">Command</div>
          <CodeBlock
            language="shell"
            codeValue={command}
            pathRoots={pathRoots}
            query={query}
            highlightPatterns={highlightPatterns}
          />
        </div>
      ) : null}
      {parsed.inputRecord ? (
        <div className="tool-use-section">
          <div className="tool-use-section-label">Arguments</div>
          <CodeBlock
            language="json"
            codeValue={JSON.stringify(parsed.inputRecord, null, 2)}
            pathRoots={pathRoots}
            query={query}
            highlightPatterns={highlightPatterns}
          />
        </div>
      ) : (
        <CodeBlock
          language="json"
          codeValue={JSON.stringify(parsed.record, null, 2)}
          pathRoots={pathRoots}
          query={query}
          highlightPatterns={highlightPatterns}
        />
      )}
    </div>
  );
}

function ToolResultContent({
  text,
  query,
  highlightPatterns,
  parsedToolPayload,
}: {
  text: string;
  query: string;
  highlightPatterns: string[];
  parsedToolPayload: ParsedMessageToolPayload;
}) {
  const parsed = parsedToolPayload.toolResult;
  if (!parsed) {
    const language = detectLanguageFromContent(text);
    return (
      <div className="tool-result-view">
        <CodeBlock
          language={language}
          codeValue={text}
          pathRoots={[]}
          query={query}
          highlightPatterns={highlightPatterns}
        />
      </div>
    );
  }

  const output = asString(parsed.output);
  const metadata = asObject(parsed.metadata);
  const normalizedOutput = output ? output : null;
  const inner = normalizedOutput ? tryParseJsonRecord(normalizedOutput) : null;
  const outputLanguage = detectLanguageFromContent(normalizedOutput ?? "");

  return (
    <div className="tool-result-view">
      {metadata ? (
        <div className="tool-use-section">
          <div className="tool-use-section-label">Metadata</div>
          <CodeBlock
            language="json"
            codeValue={JSON.stringify(metadata, null, 2)}
            pathRoots={[]}
            query={query}
            highlightPatterns={highlightPatterns}
          />
        </div>
      ) : null}
      {normalizedOutput ? (
        <div className="tool-use-section">
          <div className="tool-use-section-label">Output</div>
          <CodeBlock
            language={inner ? "json" : outputLanguage}
            codeValue={inner ? JSON.stringify(inner, null, 2) : normalizedOutput}
            pathRoots={[]}
            query={query}
            highlightPatterns={highlightPatterns}
          />
        </div>
      ) : (
        <CodeBlock
          language="json"
          codeValue={JSON.stringify(parsed, null, 2)}
          pathRoots={[]}
          query={query}
          highlightPatterns={highlightPatterns}
        />
      )}
    </div>
  );
}

function ToolEditContent({
  text,
  query,
  highlightPatterns,
  pathRoots,
  parsedToolPayload,
}: {
  text: string;
  query: string;
  highlightPatterns: string[];
  pathRoots: string[];
  parsedToolPayload: ParsedMessageToolPayload;
}) {
  const parsed = parsedToolPayload.toolEdit;
  const collapseMultiFileToolDiffs = useDocumentCollapseMultiFileToolDiffs();
  if (!parsed) {
    const formatted = tryFormatJson(text);
    return (
      <pre className="tool-block tool-edit-block">
        {buildHighlightedTextNodes(formatted, query, "tool-edit", highlightPatterns)}
      </pre>
    );
  }

  if (parsed.files.length > 1) {
    return (
      <div className="tool-edit-view">
        <div className="tool-edit-summary">
          {renderToolEditSummary(parsed.files, pathRoots, query, highlightPatterns)}
        </div>
        {parsed.files.map((file) => (
          <ToolEditFileBody
            key={`${file.changeType}:${file.filePath}:${collapseMultiFileToolDiffs ? "collapsed" : "expanded"}`}
            file={file}
            query={query}
            highlightPatterns={highlightPatterns}
            pathRoots={pathRoots}
            defaultExpanded={!collapseMultiFileToolDiffs}
          />
        ))}
      </div>
    );
  }

  if (parsed.diff && isLikelyDiff("diff", parsed.diff)) {
    return (
      <div className="tool-edit-view">
        <DiffBlock
          codeValue={parsed.diff}
          filePath={parsed.filePath}
          pathRoots={pathRoots}
          query={query}
          highlightPatterns={highlightPatterns}
          collapsible
        />
      </div>
    );
  }

  if (parsed.oldText !== null && parsed.newText !== null) {
    const diff = buildUnifiedDiffFromTextPair({
      oldText: parsed.oldText,
      newText: parsed.newText,
      filePath: parsed.filePath,
    });
    return (
      <div className="tool-edit-view">
        <DiffBlock
          codeValue={diff}
          filePath={parsed.filePath}
          pathRoots={pathRoots}
          query={query}
          highlightPatterns={highlightPatterns}
          collapsible
        />
      </div>
    );
  }

  if (parsed.newText !== null) {
    return (
      <div className="tool-edit-view">
        {parsed.filePath ? <div className="tool-edit-path">{parsed.filePath}</div> : null}
        <div className="tool-use-section">
          <div className="tool-use-section-label">Written Content</div>
          <CodeBlock
            language={detectLanguageFromFilePath(parsed.filePath)}
            codeValue={parsed.newText}
            filePath={parsed.filePath}
            pathRoots={pathRoots}
            query={query}
            highlightPatterns={highlightPatterns}
          />
        </div>
      </div>
    );
  }

  const formatted = tryFormatJson(text);
  return (
    <pre className="tool-block tool-edit-block">
      {buildHighlightedTextNodes(formatted, query, "tool-edit", highlightPatterns)}
    </pre>
  );
}

function ToolEditFileBody({
  file,
  query,
  highlightPatterns,
  pathRoots,
  defaultExpanded = true,
}: {
  file: ParsedToolEditFile;
  query: string;
  highlightPatterns: string[];
  pathRoots: string[];
  defaultExpanded?: boolean;
}) {
  if (file.diff && isLikelyDiff("diff", file.diff)) {
    return (
      <DiffBlock
        codeValue={file.diff}
        filePath={file.filePath}
        pathRoots={pathRoots}
        query={query}
        highlightPatterns={highlightPatterns}
        collapsible
        defaultExpanded={defaultExpanded}
      />
    );
  }

  if (file.oldText !== null && file.newText !== null) {
    const diff = buildUnifiedDiffFromTextPair({
      oldText: file.oldText,
      newText: file.newText,
      filePath: file.filePath,
    });
    return (
      <DiffBlock
        codeValue={diff}
        filePath={file.filePath}
        pathRoots={pathRoots}
        query={query}
        highlightPatterns={highlightPatterns}
        collapsible
        defaultExpanded={defaultExpanded}
      />
    );
  }

  if (file.newText !== null) {
    return (
      <CodeBlock
        language={detectLanguageFromFilePath(file.filePath)}
        codeValue={file.newText}
        filePath={file.filePath}
        pathRoots={pathRoots}
        query={query}
        highlightPatterns={highlightPatterns}
      />
    );
  }

  return null;
}

function renderToolEditSummary(
  files: ParsedToolEditFile[],
  pathRoots: string[],
  query: string,
  highlightPatterns: string[],
): React.ReactNode {
  const labels = files.map((file) => ({
    filePath: file.filePath,
    label: getToolEditSummaryFileLabel(file.filePath, pathRoots),
  }));
  const nodes: React.ReactNode[] = [<span key="prefix">{`${files.length} files changed: `}</span>];

  labels.forEach((entry, index) => {
    if (index > 0) {
      nodes.push(
        <span key={`sep:${entry.filePath}`}>
          {index === labels.length - 1 ? (labels.length === 2 ? " and " : ", and ") : ", "}
        </span>,
      );
    }
    nodes.push(
      <button
        type="button"
        className="tool-edit-summary-link"
        key={`file:${entry.filePath}`}
        onClick={() => {
          void openFileInEditor(entry.filePath, undefined, getCodetrailClient());
        }}
      >
        {buildHighlightedTextNodes(entry.label, query, "tool-edit-summary-link", highlightPatterns)}
      </button>,
    );
  });

  return nodes;
}

function getToolEditSummaryFileLabel(filePath: string, pathRoots: string[]): string {
  const trimmed = trimProjectPrefixFromPath(filePath, pathRoots);
  return getPathBaseName(trimmed) ?? trimmed;
}
