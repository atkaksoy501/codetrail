import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from "react";

import type { MessageCategory, Provider } from "@codetrail/core/browser";

import type {
  HistoryMessage,
  HistorySearchNavigation,
  HistorySelection,
  ProjectSummary,
  ProjectViewMode,
  SessionPaneNavigationItem,
  SessionSummary,
  TreeAutoRevealSessionRequest,
} from "../app/types";
import type { CodetrailClient } from "../lib/codetrailClient";
import type { ProjectNavigationTarget } from "../lib/historyNavigation";
import type { StableListUpdateSource } from "../lib/projectUpdates";
import type {
  HistoryCategoryFilterRestoreState,
  HistorySelectionOptions,
} from "./historyInteractionTypes";
import { useHistoryMessageInteractions } from "./useHistoryMessageInteractions";
import { useHistoryPagingInteractions } from "./useHistoryPagingInteractions";
import { useHistorySelectionInteractions } from "./useHistorySelectionInteractions";

export function useHistoryInteractions({
  common,
  categories,
  selection,
  projectPane,
  sessionPane,
  loaders,
  viewport,
  paging,
}: {
  common: {
    codetrail: CodetrailClient;
    logError: (context: string, error: unknown) => void;
    clearRefreshContext: () => void;
  };
  categories: {
    setMessageExpanded: Dispatch<SetStateAction<Record<string, boolean>>>;
    setHistoryCategories: Dispatch<SetStateAction<MessageCategory[]>>;
    historyCategoriesRef: MutableRefObject<MessageCategory[]>;
    historyCategorySoloRestoreRef: MutableRefObject<HistoryCategoryFilterRestoreState | null>;
    setExpandedByDefaultCategories: Dispatch<SetStateAction<MessageCategory[]>>;
    isExpandedByDefault: (category: MessageCategory) => boolean;
    historyCategories: MessageCategory[];
  };
  selection: {
    historyMode: HistorySelection["mode"];
    historyVisualization: "messages" | "turns" | "bookmarks";
    selection: HistorySelection;
    bookmarkReturnSelection: HistorySelection | null;
    selectedProjectId: string;
    selectedSessionId: string;
    setPendingSearchNavigation: Dispatch<SetStateAction<HistorySearchNavigation | null>>;
    setSessionQueryInput: Dispatch<SetStateAction<string>>;
    setBookmarkQueryInput: Dispatch<SetStateAction<string>>;
    setFocusMessageId: Dispatch<SetStateAction<string>>;
    setPendingRevealTarget: Dispatch<
      SetStateAction<{
        messageId: string;
        sourceId: string;
      } | null>
    >;
    setPendingMessageAreaFocus: Dispatch<SetStateAction<boolean>>;
    setPendingMessagePageNavigation: Dispatch<
      SetStateAction<{
        direction: "next" | "previous";
        targetPage: number;
      } | null>
    >;
    setSessionPage: Dispatch<SetStateAction<number>>;
    setHistorySelection: (
      value: SetStateAction<HistorySelection>,
      options?: HistorySelectionOptions,
    ) => void;
    setHistoryVisualization: Dispatch<SetStateAction<"messages" | "turns" | "bookmarks">>;
    setBookmarkReturnSelection: Dispatch<SetStateAction<HistorySelection | null>>;
  };
  projectPane: {
    projectListRef: RefObject<HTMLDivElement | null>;
    sortedProjects: ProjectSummary[];
    projectViewMode: ProjectViewMode;
    projectPaneCollapsed: boolean;
    setProjectPaneCollapsed: Dispatch<SetStateAction<boolean>>;
    sessionPaneCollapsed: boolean;
    hideSessionsPaneForTreeView: boolean;
    setProjectViewMode: Dispatch<SetStateAction<ProjectViewMode>>;
    setAutoRevealSessionRequest: Dispatch<SetStateAction<TreeAutoRevealSessionRequest | null>>;
    pendingProjectPaneFocusCommitModeRef: MutableRefObject<
      "immediate" | "debounced_project" | "debounced_session"
    >;
    pendingProjectPaneFocusWaitForKeyboardIdleRef: MutableRefObject<boolean>;
    queueProjectTreeNoopCommit: (options?: HistorySelectionOptions) => void;
    treeFocusedRow: ProjectNavigationTarget | null;
    setTreeFocusedRow: Dispatch<SetStateAction<ProjectNavigationTarget | null>>;
  };
  sessionPane: {
    sessionPaneNavigationItems: SessionPaneNavigationItem[];
    focusSessionPane: () => void;
    sessionSearchInputRef: RefObject<HTMLInputElement | null>;
  };
  loaders: {
    loadBookmarks: () => Promise<unknown>;
    loadProjects: (source?: StableListUpdateSource) => Promise<unknown>;
    loadSessions: (source?: StableListUpdateSource) => Promise<unknown>;
    refreshTreeProjectSessions: (source?: StableListUpdateSource) => Promise<void>;
    refreshVisibleBookmarkStates: () => void;
    setProjectProviders: Dispatch<SetStateAction<Provider[]>>;
    setProjectQueryInput: Dispatch<SetStateAction<string>>;
  };
  viewport: {
    messageListRef: RefObject<HTMLDivElement | null>;
    sessionScrollTopRef: MutableRefObject<number>;
    sessionScrollSyncTimerRef: MutableRefObject<number | null>;
    setSessionScrollTop: Dispatch<SetStateAction<number>>;
  };
  paging: {
    bookmarksResponse: {
      results: Array<{
        projectId: string;
        sessionId: string;
        message: HistoryMessage;
      }>;
    };
    activeHistoryMessages: HistoryMessage[];
    canNavigatePages: boolean;
    totalPages: number;
    canGoToNextHistoryPage: boolean;
    canGoToPreviousHistoryPage: boolean;
    visibleFocusedMessageId: string;
    sessionPage: number;
    messagePageSize: number;
    selectedSession: SessionSummary | null;
    selectedProject: ProjectSummary | null;
    sessionDetailTotalCount: number | null | undefined;
    allSessionsCount: number;
  };
}) {
  const selectionInteractions = useHistorySelectionInteractions({
    historyMode: selection.historyMode,
    historyVisualization: selection.historyVisualization,
    selection: selection.selection,
    bookmarkReturnSelection: selection.bookmarkReturnSelection,
    selectedProjectId: selection.selectedProjectId,
    selectedSessionId: selection.selectedSessionId,
    setPendingSearchNavigation: selection.setPendingSearchNavigation,
    setPendingMessageAreaFocus: selection.setPendingMessageAreaFocus,
    setPendingMessagePageNavigation: selection.setPendingMessagePageNavigation,
    setSessionPage: selection.setSessionPage,
    setFocusMessageId: selection.setFocusMessageId,
    setPendingRevealTarget: selection.setPendingRevealTarget,
    setHistorySelection: selection.setHistorySelection,
    setHistoryVisualization: selection.setHistoryVisualization,
    setBookmarkReturnSelection: selection.setBookmarkReturnSelection,
    clearRefreshContext: common.clearRefreshContext,
    sessionPaneNavigationItems: sessionPane.sessionPaneNavigationItems,
    projectListRef: projectPane.projectListRef,
    sortedProjects: projectPane.sortedProjects,
    projectViewMode: projectPane.projectViewMode,
    pendingProjectPaneFocusCommitModeRef: projectPane.pendingProjectPaneFocusCommitModeRef,
    pendingProjectPaneFocusWaitForKeyboardIdleRef:
      projectPane.pendingProjectPaneFocusWaitForKeyboardIdleRef,
    queueProjectTreeNoopCommit: projectPane.queueProjectTreeNoopCommit,
    treeFocusedRow: projectPane.treeFocusedRow,
    setTreeFocusedRow: projectPane.setTreeFocusedRow,
    focusSessionPane: sessionPane.focusSessionPane,
  });

  const messageInteractions = useHistoryMessageInteractions({
    codetrail: common.codetrail,
    logError: common.logError,
    historyMode: selection.historyMode,
    selectedProjectId: selection.selectedProjectId,
    selectedSessionId: selection.selectedSessionId,
    historyCategories: categories.historyCategories,
    bookmarksResponse: paging.bookmarksResponse,
    activeHistoryMessages: paging.activeHistoryMessages,
    setMessageExpanded: categories.setMessageExpanded,
    setHistoryCategories: categories.setHistoryCategories,
    historyCategoriesRef: categories.historyCategoriesRef,
    historyCategorySoloRestoreRef: categories.historyCategorySoloRestoreRef,
    setExpandedByDefaultCategories: categories.setExpandedByDefaultCategories,
    setSessionPage: selection.setSessionPage,
    isExpandedByDefault: categories.isExpandedByDefault,
    setPendingSearchNavigation: selection.setPendingSearchNavigation,
    setSessionQueryInput: selection.setSessionQueryInput,
    setBookmarkQueryInput: selection.setBookmarkQueryInput,
    setFocusMessageId: selection.setFocusMessageId,
    setPendingRevealTarget: selection.setPendingRevealTarget,
    setHistorySelection: (value) => selection.setHistorySelection(value),
    loadBookmarks: loaders.loadBookmarks,
    loadProjects: loaders.loadProjects,
    loadSessions: loaders.loadSessions,
    refreshTreeProjectSessions: loaders.refreshTreeProjectSessions,
    refreshVisibleBookmarkStates: loaders.refreshVisibleBookmarkStates,
    setProjectProviders: loaders.setProjectProviders,
    setProjectQueryInput: loaders.setProjectQueryInput,
    sessionScrollTopRef: viewport.sessionScrollTopRef,
    sessionScrollSyncTimerRef: viewport.sessionScrollSyncTimerRef,
    setSessionScrollTop: viewport.setSessionScrollTop,
    messageListRef: viewport.messageListRef,
    projectPaneCollapsed: projectPane.projectPaneCollapsed,
    setProjectPaneCollapsed: projectPane.setProjectPaneCollapsed,
    sessionPaneCollapsed: projectPane.sessionPaneCollapsed,
    hideSessionsPaneForTreeView: projectPane.hideSessionsPaneForTreeView,
    projectViewMode: projectPane.projectViewMode,
    setProjectViewMode: projectPane.setProjectViewMode,
    setAutoRevealSessionRequest: projectPane.setAutoRevealSessionRequest,
    openProjectBookmarksView: selectionInteractions.openProjectBookmarksView,
  });

  const pagingInteractions = useHistoryPagingInteractions({
    logError: common.logError,
    clearRefreshContext: common.clearRefreshContext,
    canNavigatePages: paging.canNavigatePages,
    totalPages: paging.totalPages,
    canGoToNextHistoryPage: paging.canGoToNextHistoryPage,
    canGoToPreviousHistoryPage: paging.canGoToPreviousHistoryPage,
    activeHistoryMessages: paging.activeHistoryMessages,
    visibleFocusedMessageId: paging.visibleFocusedMessageId,
    sessionPage: paging.sessionPage,
    messagePageSize: paging.messagePageSize,
    selectedSession: paging.selectedSession,
    selectedProject: paging.selectedProject,
    sessionDetailTotalCount: paging.sessionDetailTotalCount,
    allSessionsCount: paging.allSessionsCount,
    messageListRef: viewport.messageListRef,
    sessionSearchInputRef: sessionPane.sessionSearchInputRef,
    setPendingMessageAreaFocus: selection.setPendingMessageAreaFocus,
    setFocusMessageId: selection.setFocusMessageId,
    setPendingMessagePageNavigation: selection.setPendingMessagePageNavigation,
    setSessionPage: selection.setSessionPage,
    setProjectProviders: loaders.setProjectProviders,
    setProjectQueryInput: loaders.setProjectQueryInput,
    setPendingSearchNavigation: selection.setPendingSearchNavigation,
    setHistorySelection: (value) => selection.setHistorySelection(value),
    loadProjects: loaders.loadProjects,
    loadSessions: loaders.loadSessions,
    loadBookmarks: loaders.loadBookmarks,
    refreshTreeProjectSessions: loaders.refreshTreeProjectSessions,
  });

  return {
    ...messageInteractions,
    ...selectionInteractions,
    ...pagingInteractions,
  };
}
