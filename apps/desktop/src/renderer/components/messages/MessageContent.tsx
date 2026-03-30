import type { MessageCategory } from "@codetrail/core/browser";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

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
import { formatToolEditFileSummary, toolEditFileHasCollapsibleDiff } from "./toolEditUtils";
import {
  type ParsedToolEditFile,
  asNonEmptyString,
  asObject,
  asString,
  buildUnifiedDiffFromTextPair,
  tryParseJsonRecord,
} from "./toolParsing";

export function MessageContent({
  text,
  category,
  query,
  highlightPatterns = [],
  pathRoots = [],
  parsedToolPayload,
  writeDiffExpansionRequest,
  onWriteDiffStateChange,
}: {
  text: string;
  category: MessageCategory;
  query: string;
  highlightPatterns?: string[];
  pathRoots?: string[];
  parsedToolPayload?: ParsedMessageToolPayload;
  writeDiffExpansionRequest?: { expanded: boolean; version: number };
  onWriteDiffStateChange?: (state: {
    hasCollapsibleDiffs: boolean;
    allExpanded: boolean;
  }) => void;
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
        {...(writeDiffExpansionRequest ? { writeDiffExpansionRequest } : {})}
        {...(onWriteDiffStateChange ? { onWriteDiffStateChange } : {})}
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
        {...(writeDiffExpansionRequest ? { writeDiffExpansionRequest } : {})}
        {...(onWriteDiffStateChange ? { onWriteDiffStateChange } : {})}
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
  writeDiffExpansionRequest,
  onWriteDiffStateChange,
}: {
  text: string;
  query: string;
  highlightPatterns: string[];
  pathRoots: string[];
  parsedToolPayload: ParsedMessageToolPayload;
  writeDiffExpansionRequest?: { expanded: boolean; version: number };
  onWriteDiffStateChange?: (state: {
    hasCollapsibleDiffs: boolean;
    allExpanded: boolean;
  }) => void;
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
        {...(writeDiffExpansionRequest ? { writeDiffExpansionRequest } : {})}
        {...(onWriteDiffStateChange ? { onWriteDiffStateChange } : {})}
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
  writeDiffExpansionRequest,
  onWriteDiffStateChange,
}: {
  text: string;
  query: string;
  highlightPatterns: string[];
  pathRoots: string[];
  parsedToolPayload: ParsedMessageToolPayload;
  writeDiffExpansionRequest?: { expanded: boolean; version: number };
  onWriteDiffStateChange?: (state: {
    hasCollapsibleDiffs: boolean;
    allExpanded: boolean;
  }) => void;
}) {
  const parsed = parsedToolPayload.toolEdit;
  if (!parsed) {
    const formatted = tryFormatJson(text);
    return (
      <pre className="tool-block tool-edit-block">
        {buildHighlightedTextNodes(formatted, query, "tool-edit", highlightPatterns)}
      </pre>
    );
  }

  return (
    <ParsedToolEditContent
      text={text}
      parsed={parsed}
      query={query}
      highlightPatterns={highlightPatterns}
      pathRoots={pathRoots}
      {...(writeDiffExpansionRequest ? { writeDiffExpansionRequest } : {})}
      {...(onWriteDiffStateChange ? { onWriteDiffStateChange } : {})}
    />
  );
}

function ParsedToolEditContent({
  text,
  parsed,
  query,
  highlightPatterns,
  pathRoots,
  writeDiffExpansionRequest,
  onWriteDiffStateChange,
}: {
  text: string;
  parsed: NonNullable<ParsedMessageToolPayload["toolEdit"]>;
  query: string;
  highlightPatterns: string[];
  pathRoots: string[];
  writeDiffExpansionRequest?: { expanded: boolean; version: number };
  onWriteDiffStateChange?: (state: {
    hasCollapsibleDiffs: boolean;
    allExpanded: boolean;
  }) => void;
}) {
  const collapseMultiFileToolDiffs = useDocumentCollapseMultiFileToolDiffs();
  const defaultDiffExpanded = parsed.files.length > 1 ? !collapseMultiFileToolDiffs : true;
  const collapsibleDiffKeysSignature = useMemo(
    () => buildToolEditCollapsibleDiffKeys(parsed.files).join("\n"),
    [parsed.files],
  );
  const collapsibleDiffKeys = useMemo(
    () => (collapsibleDiffKeysSignature ? collapsibleDiffKeysSignature.split("\n") : []),
    [collapsibleDiffKeysSignature],
  );
  const [expandedDiffs, setExpandedDiffs] = useState<Record<string, boolean>>(() =>
    buildToolEditDiffExpansionState(collapsibleDiffKeys, defaultDiffExpanded),
  );

  useEffect(() => {
    const nextKeys = collapsibleDiffKeysSignature ? collapsibleDiffKeysSignature.split("\n") : [];
    setExpandedDiffs(buildToolEditDiffExpansionState(nextKeys, defaultDiffExpanded));
  }, [collapsibleDiffKeysSignature, defaultDiffExpanded]);

  useEffect(() => {
    const nextKeys = collapsibleDiffKeysSignature ? collapsibleDiffKeysSignature.split("\n") : [];
    if (!writeDiffExpansionRequest || nextKeys.length === 0) {
      return;
    }
    setExpandedDiffs(buildToolEditDiffExpansionState(nextKeys, writeDiffExpansionRequest.expanded));
  }, [collapsibleDiffKeysSignature, writeDiffExpansionRequest]);

  useEffect(() => {
    const nextKeys = collapsibleDiffKeysSignature ? collapsibleDiffKeysSignature.split("\n") : [];
    const hasCollapsibleDiffs = nextKeys.length > 0;
    const allExpanded =
      hasCollapsibleDiffs && nextKeys.every((key) => expandedDiffs[key] ?? defaultDiffExpanded);
    onWriteDiffStateChange?.({ hasCollapsibleDiffs, allExpanded });
  }, [collapsibleDiffKeysSignature, defaultDiffExpanded, expandedDiffs, onWriteDiffStateChange]);

  const singleFile = parsed.files[0];
  const singleFileKey = singleFile ? buildToolEditFileKey(singleFile, 0) : null;
  const handleSingleFileExpandedChange = useToolEditDiffExpansionHandler(
    singleFileKey,
    setExpandedDiffs,
  );

  if (parsed.files.length > 1) {
    return (
      <div className="tool-edit-view">
        <div className="tool-edit-summary">
          {renderToolEditSummary(parsed.files, query, highlightPatterns)}
        </div>
        {parsed.files.map((file, index) => {
          const fileKey = buildToolEditFileKey(file, index);
          return (
            <ToolEditFileBody
              key={fileKey}
              file={file}
              query={query}
              highlightPatterns={highlightPatterns}
              pathRoots={pathRoots}
              defaultExpanded={defaultDiffExpanded}
              expanded={expandedDiffs[fileKey] ?? defaultDiffExpanded}
              onExpandedChange={(expanded) => {
                setExpandedDiffs((current) => ({ ...current, [fileKey]: expanded }));
              }}
            />
          );
        })}
      </div>
    );
  }

  if (singleFile && singleFile.newText !== null && !toolEditFileHasCollapsibleDiff(singleFile)) {
    return (
      <div className="tool-edit-view">
        {singleFile.filePath ? <div className="tool-edit-path">{singleFile.filePath}</div> : null}
        <div className="tool-use-section">
          <div className="tool-use-section-label">Written Content</div>
          <CodeBlock
            language={detectLanguageFromFilePath(singleFile.filePath)}
            codeValue={singleFile.newText}
            filePath={singleFile.filePath}
            pathRoots={pathRoots}
            query={query}
            highlightPatterns={highlightPatterns}
          />
        </div>
      </div>
    );
  }

  if (singleFile) {
    const controlledExpansionProps =
      singleFileKey !== null
        ? {
            expanded: expandedDiffs[singleFileKey] ?? defaultDiffExpanded,
            onExpandedChange: handleSingleFileExpandedChange,
          }
        : {};
    return (
      <div className="tool-edit-view">
        <ToolEditFileBody
          file={singleFile}
          query={query}
          highlightPatterns={highlightPatterns}
          pathRoots={pathRoots}
          defaultExpanded={defaultDiffExpanded}
          {...controlledExpansionProps}
        />
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
  expanded,
  onExpandedChange,
}: {
  file: ParsedToolEditFile;
  query: string;
  highlightPatterns: string[];
  pathRoots: string[];
  defaultExpanded?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
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
        {...(expanded !== undefined ? { expanded } : {})}
        {...(onExpandedChange ? { onExpandedChange } : {})}
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
        {...(expanded !== undefined ? { expanded } : {})}
        {...(onExpandedChange ? { onExpandedChange } : {})}
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
  query: string,
  highlightPatterns: string[],
): React.ReactNode {
  const summary = formatToolEditFileSummary(files);
  return buildHighlightedTextNodes(summary, query, "tool-edit-summary", highlightPatterns);
}

function useToolEditDiffExpansionHandler(
  fileKey: string | null,
  setExpandedDiffs: Dispatch<SetStateAction<Record<string, boolean>>>,
) {
  return useCallback(
    (expanded: boolean) => {
      if (!fileKey) {
        return;
      }
      setExpandedDiffs((current) => ({ ...current, [fileKey]: expanded }));
    },
    [fileKey, setExpandedDiffs],
  );
}

function buildToolEditFileKey(file: ParsedToolEditFile, index: number): string {
  return `${index}:${file.changeType}:${file.filePath}`;
}

function buildToolEditDiffExpansionState(
  keys: string[],
  expanded: boolean,
): Record<string, boolean> {
  return Object.fromEntries(keys.map((key) => [key, expanded]));
}

function buildToolEditCollapsibleDiffKeys(files: ParsedToolEditFile[]): string[] {
  return files.flatMap((file, index) =>
    toolEditFileHasCollapsibleDiff(file) ? [buildToolEditFileKey(file, index)] : [],
  );
}
