import { useCallback, useEffect, useRef } from "react";
import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from "react";

import { type RefreshStrategy, isWatchRefreshStrategy } from "../app/autoRefresh";
import type {
  BookmarkListResponse,
  HistoryMessage,
  HistorySelection,
  PendingMessagePageNavigation,
  ProjectCombinedDetail,
  ProjectSummary,
  ProjectViewMode,
  SessionDetail,
  SessionSummary,
} from "../app/types";
import { type StableListUpdateSource, resolveStableRefreshSource } from "../lib/projectUpdates";
import { getMessageListFingerprint } from "./historyControllerShared";
import type { RefreshContext } from "./historyControllerTypes";
import {
  getHistoryRefreshScopeKey,
  getProjectRefreshFingerprint,
  getRefreshBaselineTotalCount,
  getSessionRefreshFingerprint,
  isLiveEdgePage,
  isPinnedToVisualRefreshEdge,
} from "./historyRefreshPolicy";
import { useHistoryViewportEffects } from "./useHistoryViewportEffects";

function getVisibleMessageAnchor(container: HTMLElement): {
  referenceMessageId: string;
  referenceOffsetTop: number;
} | null {
  const rect = container.getBoundingClientRect();
  const probeX = rect.left + Math.min(24, Math.max(1, rect.width / 2));
  const probeY = rect.top + Math.min(24, Math.max(1, rect.height / 4));
  const elementAtPoint =
    typeof document.elementFromPoint === "function"
      ? document.elementFromPoint(probeX, probeY)
      : null;
  const anchor =
    elementAtPoint instanceof HTMLElement
      ? elementAtPoint.closest<HTMLElement>("[data-history-message-id]")
      : null;
  if (anchor && container.contains(anchor)) {
    return {
      referenceMessageId: anchor.getAttribute("data-history-message-id") ?? "",
      referenceOffsetTop: anchor.offsetTop,
    };
  }

  const firstMessage = container.querySelector<HTMLElement>("[data-history-message-id]");
  if (!firstMessage) {
    return null;
  }
  return {
    referenceMessageId: firstMessage.getAttribute("data-history-message-id") ?? "",
    referenceOffsetTop: firstMessage.offsetTop,
  };
}

export function useHistoryRefreshController({
  refreshContextRef,
  initialAutoRefreshStrategy,
  messageListRef,
  detailMessages,
  effectiveHistoryPage,
  messagePageSize,
  historyMode,
  historyDetailMode,
  selectedProjectId,
  selectedSessionId,
  selectedProject,
  selectedSession,
  sessionDetail,
  projectCombinedDetail,
  bookmarksResponse,
  messageSortDirection,
  bookmarkSortDirection,
  projectAllSortDirection,
  turnViewSortDirection,
  turnSourceSessionId,
  turnAnchorMessageId,
  sessionTurnDetail,
  turnVisualizationSelection,
  canToggleTurnView,
  loadProjects,
  loadSessions,
  loadBookmarks,
  refreshTreeProjectSessions,
  requestSessionDetailRefresh,
  requestProjectCombinedDetailRefresh,
  requestTurnDetailRefresh,
  projectViewMode,
  treeProjectSessionsByProjectIdRef,
  setSessionScrollTop,
  sessionScrollTopRef,
  pendingRestoredSessionScrollRef,
  activeMessageSortDirection,
  focusMessageId,
  visibleFocusedMessageId,
  focusedMessagePosition,
  focusedMessageRef,
  pendingMessageAreaFocus,
  setPendingMessageAreaFocus,
  pendingMessagePageNavigation,
  loadedHistoryPage,
  setPendingMessagePageNavigation,
  setFocusMessageId,
}: {
  refreshContextRef: MutableRefObject<RefreshContext | null>;
  initialAutoRefreshStrategy: RefreshStrategy;
  messageListRef: RefObject<HTMLDivElement | null>;
  detailMessages: HistoryMessage[];
  effectiveHistoryPage: number;
  messagePageSize: number;
  historyMode: "session" | "bookmarks" | "project_all";
  historyDetailMode: "flat" | "turn";
  selectedProjectId: string;
  selectedSessionId: string;
  selectedProject: ProjectSummary | null;
  selectedSession: SessionSummary | null;
  sessionDetail: SessionDetail | null;
  projectCombinedDetail: ProjectCombinedDetail | null;
  bookmarksResponse: BookmarkListResponse;
  messageSortDirection: "asc" | "desc";
  bookmarkSortDirection: "asc" | "desc";
  projectAllSortDirection: "asc" | "desc";
  turnViewSortDirection: "asc" | "desc";
  turnSourceSessionId: string;
  turnAnchorMessageId: string;
  sessionTurnDetail: {
    totalCount?: number | null;
  } | null;
  turnVisualizationSelection: HistorySelection;
  canToggleTurnView: boolean;
  loadProjects: (source?: StableListUpdateSource) => Promise<ProjectSummary[] | undefined>;
  loadSessions: (source?: StableListUpdateSource) => Promise<SessionSummary[] | undefined>;
  loadBookmarks: () => Promise<unknown>;
  refreshTreeProjectSessions: (source?: StableListUpdateSource) => Promise<void>;
  requestSessionDetailRefresh: () => void;
  requestProjectCombinedDetailRefresh: () => void;
  requestTurnDetailRefresh: () => void;
  projectViewMode: ProjectViewMode;
  treeProjectSessionsByProjectIdRef: MutableRefObject<Record<string, SessionSummary[]>>;
  setSessionScrollTop: Dispatch<SetStateAction<number>>;
  sessionScrollTopRef: MutableRefObject<number>;
  pendingRestoredSessionScrollRef: MutableRefObject<{
    sessionId: string;
    sessionPage: number;
    scrollTop: number;
  } | null>;
  activeMessageSortDirection: "asc" | "desc";
  focusMessageId: string;
  visibleFocusedMessageId: string;
  focusedMessagePosition: number;
  focusedMessageRef: RefObject<HTMLDivElement | null>;
  pendingMessageAreaFocus: boolean;
  setPendingMessageAreaFocus: Dispatch<SetStateAction<boolean>>;
  pendingMessagePageNavigation: PendingMessagePageNavigation | null;
  loadedHistoryPage: number;
  setPendingMessagePageNavigation: Dispatch<SetStateAction<PendingMessagePageNavigation | null>>;
  setFocusMessageId: Dispatch<SetStateAction<string>>;
}) {
  const selectedProjectRefreshFingerprintRef = useRef("");
  const selectedSessionRefreshFingerprintRef = useRef("");
  const refreshIdCounterRef = useRef(0);
  const scrollPreservationRef = useRef<RefreshContext["scrollPreservation"]>(null);
  const pendingAutoScrollRef = useRef(false);
  const prevMessageIdsRef = useRef("");
  const startupWatchResortPendingRef = useRef(
    isWatchRefreshStrategy(initialAutoRefreshStrategy ?? "off"),
  );

  useEffect(() => {
    selectedProjectRefreshFingerprintRef.current = getProjectRefreshFingerprint(selectedProject);
  }, [selectedProject]);

  useEffect(() => {
    selectedSessionRefreshFingerprintRef.current = getSessionRefreshFingerprint(selectedSession);
  }, [selectedSession]);

  useHistoryViewportEffects({
    messageListRef,
    historyMode,
    selectedProjectId,
    selectedSessionId,
    sessionPage: effectiveHistoryPage,
    setSessionScrollTop,
    sessionScrollTopRef,
    pendingRestoredSessionScrollRef,
    refreshContextRef,
    pendingAutoScrollRef,
    prevMessageIdsRef,
    activeHistoryMessages: detailMessages,
    activeMessageSortDirection,
    focusMessageId,
    visibleFocusedMessageId,
    focusedMessagePosition,
    focusedMessageRef,
    pendingMessageAreaFocus,
    setPendingMessageAreaFocus,
    pendingMessagePageNavigation,
    loadedHistoryPage,
    setPendingMessagePageNavigation,
    setFocusMessageId,
    scrollPreservationRef,
  });

  const handleRefreshAllData = useCallback(
    async (source: "manual" | "auto" = "manual", options: { historyViewActive?: boolean } = {}) => {
      const container = messageListRef.current;
      const id = ++refreshIdCounterRef.current;
      const historyViewActive = options.historyViewActive ?? true;

      const sortDir =
        historyDetailMode === "turn"
          ? turnViewSortDirection
          : historyMode === "project_all"
            ? projectAllSortDirection
            : historyMode === "bookmarks"
              ? bookmarkSortDirection
              : messageSortDirection;
      const scopeKey =
        historyDetailMode === "turn"
          ? `turn:${turnSourceSessionId}:${turnAnchorMessageId}`
          : getHistoryRefreshScopeKey(historyMode, selectedProjectId, selectedSessionId);
      const baselineTotalCount =
        historyDetailMode === "turn"
          ? (sessionTurnDetail?.totalCount ?? detailMessages.length)
          : getRefreshBaselineTotalCount({
              historyMode,
              selectedProject,
              selectedSession,
              sessionDetail,
              projectCombinedDetailTotalCount: projectCombinedDetail?.totalCount,
              bookmarksResponse,
            });
      const isAtVisualEdge = container
        ? isPinnedToVisualRefreshEdge({
            sortDirection: sortDir,
            scrollTop: container.scrollTop,
            clientHeight: container.clientHeight,
            scrollHeight: container.scrollHeight,
          })
        : false;
      const isOnLiveEdgePage =
        historyMode !== "bookmarks" &&
        isLiveEdgePage({
          sortDirection: sortDir,
          page: effectiveHistoryPage,
          totalCount: baselineTotalCount,
          pageSize: messagePageSize,
        });
      const followEligible = isAtVisualEdge && isOnLiveEdgePage;

      let scrollPreservation: RefreshContext["scrollPreservation"] = null;
      let prevMessageIds = "";

      if (followEligible) {
        prevMessageIds = getMessageListFingerprint(detailMessages);
      } else if (container) {
        const anchor = getVisibleMessageAnchor(container);
        scrollPreservation = anchor
          ? {
              scrollTop: container.scrollTop,
              referenceMessageId: anchor.referenceMessageId,
              referenceOffsetTop: anchor.referenceOffsetTop,
            }
          : null;
      }

      const refreshContext: RefreshContext = {
        refreshId: id,
        originPage: effectiveHistoryPage,
        scopeKey,
        baselineTotalCount,
        followEligible,
        scrollPreservation,
        prevMessageIds,
      };
      const { updateSource, clearStartupWatchResort } = resolveStableRefreshSource(
        source,
        startupWatchResortPendingRef.current,
      );
      const consumeRefreshContext = async (
        target: "bookmarks" | "session" | "project_all" | "turn" | null,
      ) => {
        if (target === null) {
          refreshContextRef.current = null;
          return;
        }
        refreshContextRef.current = refreshContext;
        if (target === "bookmarks") {
          await loadBookmarks();
          return;
        }
        if (target === "session") {
          requestSessionDetailRefresh();
          return;
        }
        if (target === "turn") {
          requestTurnDetailRefresh();
          return;
        }
        requestProjectCombinedDetailRefresh();
      };

      if (source === "manual") {
        const sharedLoads: Promise<unknown>[] = [
          loadProjects(updateSource),
          loadSessions(updateSource),
          refreshTreeProjectSessions(updateSource),
        ];
        if (historyMode !== "bookmarks") {
          sharedLoads.push(loadBookmarks());
        }
        await Promise.all(sharedLoads);
        if (clearStartupWatchResort) {
          startupWatchResortPendingRef.current = false;
        }
        const refreshTarget =
          historyDetailMode === "turn" && historyViewActive && canToggleTurnView
            ? "turn"
            : historyMode === "bookmarks" && selectedProjectId
              ? "bookmarks"
              : historyMode === "session" && selectedSessionId
                ? "session"
                : historyMode === "project_all" && selectedProjectId
                  ? "project_all"
                  : null;
        await consumeRefreshContext(refreshTarget);
        return;
      }

      const previousProjectFingerprint = selectedProjectRefreshFingerprintRef.current;
      const previousSessionFingerprint = selectedSessionRefreshFingerprintRef.current;
      const nextProjects = await loadProjects(updateSource);
      if (clearStartupWatchResort) {
        startupWatchResortPendingRef.current = false;
      }
      const nextSelectedProject =
        nextProjects?.find((project) => project.id === selectedProjectId) ?? null;
      const projectFingerprintChanged =
        previousProjectFingerprint.length > 0 &&
        nextSelectedProject !== null &&
        getProjectRefreshFingerprint(nextSelectedProject) !== previousProjectFingerprint;

      let sessionFingerprintChanged = false;
      if (historyViewActive && selectedProjectId) {
        const nextSessions = await loadSessions(updateSource);
        const nextSelectedSession =
          nextSessions?.find((session) => session.id === selectedSessionId) ?? null;
        sessionFingerprintChanged =
          previousSessionFingerprint.length > 0 &&
          nextSelectedSession !== null &&
          getSessionRefreshFingerprint(nextSelectedSession) !== previousSessionFingerprint;
      }

      const refreshTarget =
        historyViewActive &&
        historyDetailMode === "turn" &&
        canToggleTurnView &&
        (turnVisualizationSelection.mode === "session"
          ? sessionFingerprintChanged && Boolean(turnVisualizationSelection.sessionId)
          : projectFingerprintChanged && Boolean(turnVisualizationSelection.projectId))
          ? "turn"
          : historyMode === "bookmarks" && historyViewActive && selectedProjectId
            ? "bookmarks"
            : historyViewActive &&
                historyMode === "session" &&
                sessionFingerprintChanged &&
                selectedSessionId
              ? "session"
              : historyViewActive &&
                  historyMode === "project_all" &&
                  projectFingerprintChanged &&
                  selectedProjectId
                ? "project_all"
                : null;
      await consumeRefreshContext(refreshTarget);

      if (
        historyViewActive &&
        projectViewMode === "tree" &&
        Object.keys(treeProjectSessionsByProjectIdRef.current).length > 0
      ) {
        await refreshTreeProjectSessions(updateSource);
      }
    },
    [
      bookmarkSortDirection,
      bookmarksResponse,
      canToggleTurnView,
      detailMessages,
      effectiveHistoryPage,
      historyDetailMode,
      historyMode,
      loadBookmarks,
      loadProjects,
      loadSessions,
      messageListRef,
      messagePageSize,
      messageSortDirection,
      projectCombinedDetail,
      projectAllSortDirection,
      projectViewMode,
      refreshContextRef,
      refreshTreeProjectSessions,
      requestProjectCombinedDetailRefresh,
      requestSessionDetailRefresh,
      requestTurnDetailRefresh,
      selectedProject,
      selectedProjectId,
      selectedSession,
      selectedSessionId,
      sessionDetail,
      sessionTurnDetail,
      treeProjectSessionsByProjectIdRef,
      turnAnchorMessageId,
      turnSourceSessionId,
      turnViewSortDirection,
      turnVisualizationSelection,
    ],
  );

  return {
    handleRefreshAllData,
  };
}
