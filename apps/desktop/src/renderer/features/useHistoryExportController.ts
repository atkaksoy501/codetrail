import { useCallback, useEffect, useState } from "react";

import type { MessageCategory, SearchMode } from "@codetrail/core/browser";

import type { HistoryExportProgressPayload } from "../../shared/historyExport";
import type { HistoryExportScope } from "../app/types";
import type { CodetrailClient } from "../lib/codetrailClient";
import type { HistoryExportState } from "./historyControllerTypes";

export function useHistoryExportController({
  codetrail,
  logError,
  historyDetailMode,
  historyMode,
  selectedProjectId,
  selectedSessionId,
  loadedHistoryPage,
  messagePageSize,
  historyCategories,
  effectiveBookmarkQuery,
  effectiveSessionQuery,
  searchMode,
  activeMessageSortDirection,
}: {
  codetrail: CodetrailClient;
  logError: (context: string, error: unknown) => void;
  historyDetailMode: "flat" | "turn";
  historyMode: "session" | "bookmarks" | "project_all";
  selectedProjectId: string;
  selectedSessionId: string;
  loadedHistoryPage: number;
  messagePageSize: number;
  historyCategories: MessageCategory[];
  effectiveBookmarkQuery: string;
  effectiveSessionQuery: string;
  searchMode: SearchMode;
  activeMessageSortDirection: "asc" | "desc";
}) {
  const [historyExportState, setHistoryExportState] = useState<HistoryExportState>({
    open: false,
    exportId: null,
    scope: "current_page",
    percent: 0,
    phase: "preparing",
    message: "",
  });

  useEffect(() => {
    return codetrail.onHistoryExportProgress((progress: HistoryExportProgressPayload) => {
      setHistoryExportState((current) =>
        current.exportId !== progress.exportId
          ? current
          : {
              ...current,
              percent: progress.percent,
              phase: progress.phase,
              message: progress.message,
            },
      );
    });
  }, [codetrail]);

  const handleExportMessages = useCallback(
    async ({ scope }: { scope: HistoryExportScope }) => {
      if (historyDetailMode === "turn" || !selectedProjectId) {
        return {
          canceled: true,
          path: null,
        };
      }

      const exportId =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `export_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      setHistoryExportState({
        open: true,
        exportId,
        scope,
        percent: 1,
        phase: "preparing",
        message: "Preparing export…",
      });

      try {
        const response = await codetrail.invoke("history:exportMessages", {
          exportId,
          mode: historyMode,
          projectId: selectedProjectId,
          ...(selectedSessionId ? { sessionId: selectedSessionId } : {}),
          page: loadedHistoryPage,
          pageSize: messagePageSize,
          categories: historyCategories,
          query: historyMode === "bookmarks" ? effectiveBookmarkQuery : effectiveSessionQuery,
          searchMode,
          sortDirection: activeMessageSortDirection,
          scope,
        });
        setHistoryExportState((current) =>
          current.exportId === exportId
            ? { ...current, open: false, exportId: null, percent: 100, message: "" }
            : current,
        );
        return response;
      } catch (error) {
        setHistoryExportState((current) =>
          current.exportId === exportId
            ? { ...current, open: false, exportId: null, message: "" }
            : current,
        );
        logError("History messages export failed", error);
        throw error;
      }
    },
    [
      activeMessageSortDirection,
      codetrail,
      effectiveBookmarkQuery,
      effectiveSessionQuery,
      historyCategories,
      historyDetailMode,
      historyMode,
      loadedHistoryPage,
      logError,
      messagePageSize,
      searchMode,
      selectedProjectId,
      selectedSessionId,
    ],
  );

  return {
    historyExportState,
    handleExportMessages,
  };
}
