import { useCallback } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";

import type { Provider } from "@codetrail/core/browser";

import { PROVIDERS } from "../app/constants";
import { setHistorySelectionProjectId } from "../app/historySelection";
import type {
  HistoryMessage,
  HistorySearchNavigation,
  HistorySelection,
  PendingMessagePageNavigation,
  ProjectSummary,
  SessionSummary,
} from "../app/types";
import { copyTextToClipboard } from "../lib/clipboard";
import { getFirstVisibleMessageId } from "../lib/historyNavigation";
import type { Direction } from "../lib/historyNavigation";
import { getAdjacentItemId } from "../lib/historyNavigation";
import type { StableListUpdateSource } from "../lib/projectUpdates";
import { formatProjectDetails, formatSessionDetails } from "./historyCopyFormat";

export function useHistoryPagingInteractions({
  logError,
  clearRefreshContext,
  canNavigatePages,
  totalPages,
  canGoToNextHistoryPage,
  canGoToPreviousHistoryPage,
  activeHistoryMessages,
  visibleFocusedMessageId,
  sessionPage,
  messagePageSize,
  selectedSession,
  selectedProject,
  sessionDetailTotalCount,
  allSessionsCount,
  messageListRef,
  sessionSearchInputRef,
  setPendingMessageAreaFocus,
  setFocusMessageId,
  setPendingMessagePageNavigation,
  setSessionPage,
  setProjectProviders,
  setProjectQueryInput,
  setPendingSearchNavigation,
  setHistorySelection,
  loadProjects,
  loadSessions,
  loadBookmarks,
  refreshTreeProjectSessions,
}: {
  logError: (context: string, error: unknown) => void;
  clearRefreshContext: () => void;
  canNavigatePages: boolean;
  totalPages: number;
  canGoToNextHistoryPage: boolean;
  canGoToPreviousHistoryPage: boolean;
  activeHistoryMessages: HistoryMessage[];
  visibleFocusedMessageId: string;
  sessionPage: number;
  messagePageSize: number;
  selectedSession: SessionSummary | null;
  selectedProject: ProjectSummary | null;
  sessionDetailTotalCount: number | null | undefined;
  allSessionsCount: number;
  messageListRef: RefObject<HTMLDivElement | null>;
  sessionSearchInputRef: RefObject<HTMLInputElement | null>;
  setPendingMessageAreaFocus: Dispatch<SetStateAction<boolean>>;
  setFocusMessageId: Dispatch<SetStateAction<string>>;
  setPendingMessagePageNavigation: Dispatch<SetStateAction<PendingMessagePageNavigation | null>>;
  setSessionPage: Dispatch<SetStateAction<number>>;
  setProjectProviders: Dispatch<SetStateAction<Provider[]>>;
  setProjectQueryInput: Dispatch<SetStateAction<string>>;
  setPendingSearchNavigation: Dispatch<SetStateAction<HistorySearchNavigation | null>>;
  setHistorySelection: Dispatch<SetStateAction<HistorySelection>>;
  loadProjects: (source?: StableListUpdateSource) => Promise<unknown>;
  loadSessions: (source?: StableListUpdateSource) => Promise<unknown>;
  loadBookmarks: () => Promise<unknown>;
  refreshTreeProjectSessions: (source?: StableListUpdateSource) => Promise<void>;
}) {
  const goToHistoryPage = useCallback(
    (page: number) => {
      if (!canNavigatePages) {
        return;
      }
      const targetPage = Math.max(0, Math.min(totalPages - 1, Math.trunc(page)));
      clearRefreshContext();
      setPendingMessagePageNavigation(null);
      setSessionPage(targetPage);
    },
    [
      canNavigatePages,
      clearRefreshContext,
      setPendingMessagePageNavigation,
      setSessionPage,
      totalPages,
    ],
  );

  const goToPreviousHistoryPage = useCallback(() => {
    if (!canNavigatePages) {
      return;
    }
    clearRefreshContext();
    setPendingMessagePageNavigation(null);
    setSessionPage((value) => Math.max(0, value - 1));
  }, [canNavigatePages, clearRefreshContext, setPendingMessagePageNavigation, setSessionPage]);

  const goToNextHistoryPage = useCallback(() => {
    if (!canNavigatePages) {
      return;
    }
    clearRefreshContext();
    setPendingMessagePageNavigation(null);
    setSessionPage((value) => Math.min(totalPages - 1, value + 1));
  }, [
    canNavigatePages,
    clearRefreshContext,
    setPendingMessagePageNavigation,
    setSessionPage,
    totalPages,
  ]);

  const goToFirstHistoryPage = useCallback(() => {
    goToHistoryPage(0);
  }, [goToHistoryPage]);

  const goToLastHistoryPage = useCallback(() => {
    goToHistoryPage(totalPages - 1);
  }, [goToHistoryPage, totalPages]);

  const focusAdjacentHistoryMessage = useCallback(
    (direction: Direction, { preserveFocus = false }: { preserveFocus?: boolean } = {}) => {
      if (activeHistoryMessages.length === 0) {
        return;
      }

      const preservedElement =
        preserveFocus && document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      const restorePreservedFocus = () => {
        if (!preservedElement || !preservedElement.isConnected) {
          return;
        }
        window.setTimeout(() => {
          if (!preservedElement.isConnected) {
            return;
          }
          preservedElement.focus({ preventScroll: true });
        }, 0);
      };

      if (!visibleFocusedMessageId) {
        const firstVisibleMessageId = getFirstVisibleMessageId(messageListRef.current);
        if (firstVisibleMessageId) {
          setPendingMessageAreaFocus(!preserveFocus);
          setFocusMessageId(firstVisibleMessageId);
          restorePreservedFocus();
        }
        return;
      }

      const adjacentMessageId = getAdjacentItemId(
        activeHistoryMessages,
        visibleFocusedMessageId,
        direction,
      );
      if (adjacentMessageId) {
        setPendingMessageAreaFocus(!preserveFocus);
        setFocusMessageId(adjacentMessageId);
        restorePreservedFocus();
        return;
      }

      const canAdvancePage =
        direction === "next" ? canGoToNextHistoryPage : canGoToPreviousHistoryPage;
      if (!canAdvancePage) {
        setPendingMessageAreaFocus(!preserveFocus);
        restorePreservedFocus();
        return;
      }

      const targetPage =
        direction === "next"
          ? Math.min(totalPages - 1, sessionPage + 1)
          : Math.max(0, sessionPage - 1);
      clearRefreshContext();
      setPendingMessageAreaFocus(!preserveFocus);
      setPendingMessagePageNavigation({ direction, targetPage });
      setSessionPage(targetPage);
      restorePreservedFocus();
    },
    [
      activeHistoryMessages,
      canGoToNextHistoryPage,
      canGoToPreviousHistoryPage,
      clearRefreshContext,
      messageListRef,
      sessionPage,
      setFocusMessageId,
      setPendingMessageAreaFocus,
      setPendingMessagePageNavigation,
      setSessionPage,
      totalPages,
      visibleFocusedMessageId,
    ],
  );

  const handleCopySessionDetails = useCallback(async () => {
    if (!selectedSession) {
      return;
    }
    const messageCount = sessionDetailTotalCount ?? selectedSession.messageCount;
    const pageCount = Math.max(1, Math.ceil(messageCount / messagePageSize));
    const copied = await copyTextToClipboard(
      formatSessionDetails(selectedSession, {
        projectLabel: selectedProject?.name || selectedProject?.path || "(unknown project)",
        messageCount,
        page: { current: sessionPage + 1, total: pageCount },
      }),
    );
    if (!copied) {
      logError("Failed copying session details", "Clipboard API unavailable");
    }
  }, [
    logError,
    messagePageSize,
    selectedProject,
    selectedSession,
    sessionDetailTotalCount,
    sessionPage,
  ]);

  const handleCopyProjectDetails = useCallback(async () => {
    if (!selectedProject) {
      return;
    }
    const copied = await copyTextToClipboard(
      formatProjectDetails(selectedProject, { messageCount: allSessionsCount }),
    );
    if (!copied) {
      logError("Failed copying project details", "Clipboard API unavailable");
    }
  }, [allSessionsCount, logError, selectedProject]);

  const focusSessionSearch = useCallback(() => {
    window.setTimeout(() => {
      sessionSearchInputRef.current?.focus();
      sessionSearchInputRef.current?.select();
    }, 0);
  }, [sessionSearchInputRef]);

  const handleRefresh = useCallback(async () => {
    const updateSource: StableListUpdateSource = "resort";
    await Promise.all([
      loadProjects(updateSource),
      loadSessions(updateSource),
      loadBookmarks(),
      refreshTreeProjectSessions(updateSource),
    ]);
  }, [loadBookmarks, loadProjects, loadSessions, refreshTreeProjectSessions]);

  const navigateFromSearchResult = useCallback(
    (navigation: HistorySearchNavigation) => {
      setProjectProviders((value) => (value.length === PROVIDERS.length ? value : [...PROVIDERS]));
      setProjectQueryInput("");
      setPendingSearchNavigation(navigation);
      if (navigation.targetMode === "project_all") {
        setHistorySelection({ mode: "project_all", projectId: navigation.projectId });
        return;
      }
      setHistorySelection((selectionState) =>
        setHistorySelectionProjectId(selectionState, navigation.projectId),
      );
    },
    [setHistorySelection, setPendingSearchNavigation, setProjectProviders, setProjectQueryInput],
  );

  return {
    goToHistoryPage,
    goToFirstHistoryPage,
    goToLastHistoryPage,
    goToPreviousHistoryPage,
    goToNextHistoryPage,
    focusAdjacentHistoryMessage,
    handleCopySessionDetails,
    handleCopyProjectDetails,
    focusSessionSearch,
    handleRefresh,
    navigateFromSearchResult,
  };
}
