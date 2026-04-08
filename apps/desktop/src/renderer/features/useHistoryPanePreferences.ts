import { useRef, useState } from "react";

import type { MessageCategory, Provider, SystemMessageRegexRules } from "@codetrail/core/browser";

import { DEFAULT_PREFERRED_REFRESH_STRATEGY, type NonOffRefreshStrategy } from "../app/autoRefresh";
import {
  DEFAULT_MESSAGE_CATEGORIES,
  DEFAULT_TURN_VIEW_EXPANDED_CATEGORIES,
  DEFAULT_TURN_VIEW_MESSAGE_CATEGORIES,
  EMPTY_SYSTEM_MESSAGE_REGEX_RULES,
} from "../app/constants";
import type {
  PaneStateSnapshot,
  ProjectSortField,
  ProjectViewMode,
  SortDirection,
} from "../app/types";
import { useReconcileProviderSelection } from "../hooks/useReconcileProviderSelection";
import { useResizablePanes } from "../hooks/useResizablePanes";
import { clamp } from "../lib/viewUtils";
import {
  deriveHistoryVisualization,
  getHistoryDetailModeForVisualization,
} from "./historyVisualization";

export function useHistoryPanePreferences({
  initialPaneState,
  isHistoryLayout,
  enabledProviders,
}: {
  initialPaneState: PaneStateSnapshot | null | undefined;
  isHistoryLayout: boolean;
  enabledProviders: Provider[];
}) {
  const initialProjectPaneWidth = clamp(initialPaneState?.projectPaneWidth ?? 300, 230, 520);
  const initialSessionPaneWidth = clamp(initialPaneState?.sessionPaneWidth ?? 320, 250, 620);
  const initialSessionScrollTop = initialPaneState?.sessionScrollTop ?? 0;

  const [
    removeMissingSessionsDuringIncrementalIndexing,
    setRemoveMissingSessionsDuringIncrementalIndexing,
  ] = useState(initialPaneState?.removeMissingSessionsDuringIncrementalIndexing ?? false);
  const [projectProviders, setProjectProviders] = useState<Provider[]>(
    (initialPaneState?.projectProviders ?? enabledProviders).filter((provider) =>
      enabledProviders.includes(provider),
    ),
  );
  const [sessionScrollTop, setSessionScrollTop] = useState(initialSessionScrollTop);
  const [systemMessageRegexRules, setSystemMessageRegexRules] = useState<SystemMessageRegexRules>(
    initialPaneState?.systemMessageRegexRules
      ? { ...EMPTY_SYSTEM_MESSAGE_REGEX_RULES, ...initialPaneState.systemMessageRegexRules }
      : EMPTY_SYSTEM_MESSAGE_REGEX_RULES,
  );
  const [projectViewMode, setProjectViewMode] = useState<ProjectViewMode>(
    initialPaneState?.projectViewMode ?? "tree",
  );
  const [projectSortField, setProjectSortField] = useState<ProjectSortField>(
    initialPaneState?.projectSortField ?? "last_active",
  );
  const [projectSortDirection, setProjectSortDirection] = useState<SortDirection>(
    initialPaneState?.projectSortDirection ?? "desc",
  );
  const [sessionSortDirection, setSessionSortDirection] = useState<SortDirection>(
    initialPaneState?.sessionSortDirection ?? "desc",
  );
  const [messageSortDirection, setMessageSortDirection] = useState<SortDirection>(
    initialPaneState?.messageSortDirection ?? "desc",
  );
  const [bookmarkSortDirection, setBookmarkSortDirection] = useState<SortDirection>(
    initialPaneState?.bookmarkSortDirection ?? "desc",
  );
  const [projectAllSortDirection, setProjectAllSortDirection] = useState<SortDirection>(
    initialPaneState?.projectAllSortDirection ?? "desc",
  );
  const [turnViewSortDirection, setTurnViewSortDirection] = useState<SortDirection>(
    initialPaneState?.turnViewSortDirection ?? initialPaneState?.messageSortDirection ?? "desc",
  );
  const [preferredAutoRefreshStrategy, setPreferredAutoRefreshStrategy] =
    useState<NonOffRefreshStrategy>(
      initialPaneState?.preferredAutoRefreshStrategy ?? DEFAULT_PREFERRED_REFRESH_STRATEGY,
    );
  const [historyCategories, setHistoryCategories] = useState<MessageCategory[]>(
    initialPaneState?.historyCategories ?? [...DEFAULT_MESSAGE_CATEGORIES],
  );
  const historyCategoriesRef = useRef<MessageCategory[]>(historyCategories);
  const historyCategorySoloRestoreRef = useRef<{
    mode: `solo:${MessageCategory}` | "preset:primary" | "preset:all";
    categories: MessageCategory[];
  } | null>(null);
  const [expandedByDefaultCategories, setExpandedByDefaultCategories] = useState<MessageCategory[]>(
    initialPaneState?.expandedByDefaultCategories ?? [...DEFAULT_MESSAGE_CATEGORIES],
  );
  const [turnViewCategories, setTurnViewCategories] = useState<MessageCategory[]>(
    initialPaneState?.turnViewCategories ?? [...DEFAULT_TURN_VIEW_MESSAGE_CATEGORIES],
  );
  const [turnViewExpandedByDefaultCategories, setTurnViewExpandedByDefaultCategories] = useState<
    MessageCategory[]
  >(
    initialPaneState?.turnViewExpandedByDefaultCategories ?? [
      ...DEFAULT_TURN_VIEW_EXPANDED_CATEGORIES,
    ],
  );
  const [turnViewCombinedChangesExpanded, setTurnViewCombinedChangesExpanded] = useState(
    initialPaneState?.turnViewCombinedChangesExpanded ?? false,
  );
  const turnViewCategoriesRef = useRef<MessageCategory[]>(turnViewCategories);
  const turnViewCategorySoloRestoreRef = useRef<{
    mode: `solo:${MessageCategory}` | "preset:primary" | "preset:all";
    categories: MessageCategory[];
  } | null>(null);
  const [historyVisualization, setHistoryVisualization] = useState(
    deriveHistoryVisualization(
      initialPaneState?.historyMode ?? "project_all",
      initialPaneState?.historyDetailMode ?? "flat",
    ),
  );
  const [liveWatchEnabled, setLiveWatchEnabled] = useState(
    initialPaneState?.liveWatchEnabled ?? true,
  );
  const [liveWatchRowHasBackground, setLiveWatchRowHasBackground] = useState(
    initialPaneState?.liveWatchRowHasBackground ?? true,
  );
  const [claudeHooksPrompted, setClaudeHooksPrompted] = useState(
    initialPaneState?.claudeHooksPrompted ?? false,
  );
  const [projectPaneCollapsed, setProjectPaneCollapsed] = useState(
    initialPaneState?.projectPaneCollapsed ?? false,
  );
  const [sessionPaneCollapsed, setSessionPaneCollapsed] = useState(
    initialPaneState?.sessionPaneCollapsed ?? true,
  );
  const [singleClickFoldersExpand, setSingleClickFoldersExpand] = useState(
    initialPaneState?.singleClickFoldersExpand ?? true,
  );
  const [singleClickProjectsExpand, setSingleClickProjectsExpand] = useState(
    initialPaneState?.singleClickProjectsExpand ?? false,
  );
  const [hideSessionsPaneInTreeView, setHideSessionsPaneInTreeView] = useState(
    initialPaneState?.hideSessionsPaneInTreeView ?? false,
  );

  const {
    projectPaneWidth,
    setProjectPaneWidth,
    sessionPaneWidth,
    setSessionPaneWidth,
    beginResize,
  } = useResizablePanes({
    isHistoryLayout,
    projectMin: 230,
    projectMax: 520,
    sessionMin: 250,
    sessionMax: 620,
    initialProjectPaneWidth,
    initialSessionPaneWidth,
  });

  useReconcileProviderSelection(enabledProviders, setProjectProviders);

  return {
    initialSessionScrollTop,
    sessionScrollTop,
    setSessionScrollTop,
    projectProviders,
    setProjectProviders,
    removeMissingSessionsDuringIncrementalIndexing,
    setRemoveMissingSessionsDuringIncrementalIndexing,
    systemMessageRegexRules,
    setSystemMessageRegexRules,
    projectViewMode,
    setProjectViewMode,
    projectSortField,
    setProjectSortField,
    projectSortDirection,
    setProjectSortDirection,
    sessionSortDirection,
    setSessionSortDirection,
    messageSortDirection,
    setMessageSortDirection,
    bookmarkSortDirection,
    setBookmarkSortDirection,
    projectAllSortDirection,
    setProjectAllSortDirection,
    turnViewSortDirection,
    setTurnViewSortDirection,
    preferredAutoRefreshStrategy,
    setPreferredAutoRefreshStrategy,
    historyCategories,
    setHistoryCategories,
    historyCategoriesRef,
    historyCategorySoloRestoreRef,
    expandedByDefaultCategories,
    setExpandedByDefaultCategories,
    turnViewCategories,
    setTurnViewCategories,
    turnViewCategoriesRef,
    turnViewCategorySoloRestoreRef,
    turnViewExpandedByDefaultCategories,
    setTurnViewExpandedByDefaultCategories,
    turnViewCombinedChangesExpanded,
    setTurnViewCombinedChangesExpanded,
    historyVisualization,
    setHistoryVisualization,
    historyDetailMode: getHistoryDetailModeForVisualization(historyVisualization),
    liveWatchEnabled,
    setLiveWatchEnabled,
    liveWatchRowHasBackground,
    setLiveWatchRowHasBackground,
    claudeHooksPrompted,
    setClaudeHooksPrompted,
    projectPaneCollapsed,
    setProjectPaneCollapsed,
    sessionPaneCollapsed,
    setSessionPaneCollapsed,
    singleClickFoldersExpand,
    setSingleClickFoldersExpand,
    singleClickProjectsExpand,
    setSingleClickProjectsExpand,
    hideSessionsPaneInTreeView,
    setHideSessionsPaneInTreeView,
    hideSessionsPaneForTreeView: hideSessionsPaneInTreeView && projectViewMode === "tree",
    projectPaneWidth,
    setProjectPaneWidth,
    sessionPaneWidth,
    setSessionPaneWidth,
    beginResize,
  };
}
