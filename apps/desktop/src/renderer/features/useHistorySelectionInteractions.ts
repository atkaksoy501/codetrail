import { useCallback } from "react";
import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from "react";
import { flushSync } from "react-dom";

import { BOOKMARKS_NAV_ID, PROJECT_ALL_NAV_ID } from "../app/constants";
import { createHistorySelection } from "../app/historySelection";
import type {
  HistorySearchNavigation,
  HistorySelection,
  HistoryVisualization,
  PendingMessagePageNavigation,
  PendingRevealTarget,
  ProjectSummary,
  ProjectViewMode,
  SessionPaneNavigationItem,
} from "../app/types";
import {
  type Direction,
  type ProjectNavigationTarget,
  getAdjacentItemId,
  getAdjacentVisibleProjectTarget,
  getProjectNavigationTargetFromContainer,
  getProjectNavigationTargetFromElement,
  getProjectParentFolderTarget,
} from "../lib/historyNavigation";
import type { AdjacentSelectionOptions, HistorySelectionOptions } from "./historyInteractionTypes";

function focusVisibleProjectTarget(
  projectListElement: HTMLDivElement | null,
  element: HTMLElement | null,
) {
  if (!projectListElement || !element) {
    return;
  }
  element.focus({ preventScroll: true });
  element.scrollIntoView?.({ block: "nearest" });
}

export function useHistorySelectionInteractions({
  historyMode,
  historyVisualization,
  selection,
  bookmarkReturnSelection,
  selectedProjectId,
  selectedSessionId,
  setPendingSearchNavigation,
  setPendingMessageAreaFocus,
  setPendingMessagePageNavigation,
  setSessionPage,
  setFocusMessageId,
  setPendingRevealTarget,
  setHistorySelection,
  setHistoryVisualization,
  setBookmarkReturnSelection,
  clearRefreshContext,
  sessionPaneNavigationItems,
  projectListRef,
  sortedProjects,
  projectViewMode,
  pendingProjectPaneFocusCommitModeRef,
  pendingProjectPaneFocusWaitForKeyboardIdleRef,
  queueProjectTreeNoopCommit,
  treeFocusedRow,
  setTreeFocusedRow,
  focusSessionPane,
}: {
  historyMode: HistorySelection["mode"];
  historyVisualization: HistoryVisualization;
  selection: HistorySelection;
  bookmarkReturnSelection: HistorySelection | null;
  selectedProjectId: string;
  selectedSessionId: string;
  setPendingSearchNavigation: Dispatch<SetStateAction<HistorySearchNavigation | null>>;
  setPendingMessageAreaFocus: Dispatch<SetStateAction<boolean>>;
  setPendingMessagePageNavigation: Dispatch<SetStateAction<PendingMessagePageNavigation | null>>;
  setSessionPage: Dispatch<SetStateAction<number>>;
  setFocusMessageId: Dispatch<SetStateAction<string>>;
  setPendingRevealTarget: Dispatch<SetStateAction<PendingRevealTarget | null>>;
  setHistorySelection: (
    value: SetStateAction<HistorySelection>,
    options?: HistorySelectionOptions,
  ) => void;
  setHistoryVisualization: Dispatch<SetStateAction<HistoryVisualization>>;
  setBookmarkReturnSelection: Dispatch<SetStateAction<HistorySelection | null>>;
  clearRefreshContext: () => void;
  sessionPaneNavigationItems: SessionPaneNavigationItem[];
  projectListRef: RefObject<HTMLDivElement | null>;
  sortedProjects: ProjectSummary[];
  projectViewMode: ProjectViewMode;
  pendingProjectPaneFocusCommitModeRef: MutableRefObject<
    "immediate" | "debounced_project" | "debounced_session"
  >;
  pendingProjectPaneFocusWaitForKeyboardIdleRef: MutableRefObject<boolean>;
  queueProjectTreeNoopCommit: (options?: HistorySelectionOptions) => void;
  treeFocusedRow: ProjectNavigationTarget | null;
  setTreeFocusedRow: Dispatch<SetStateAction<ProjectNavigationTarget | null>>;
  focusSessionPane: () => void;
}) {
  const resetHistorySelectionState = useCallback(() => {
    clearRefreshContext();
    setPendingSearchNavigation(null);
    setPendingMessageAreaFocus(false);
    setPendingMessagePageNavigation(null);
    setSessionPage(0);
    setFocusMessageId("");
    setPendingRevealTarget(null);
  }, [
    clearRefreshContext,
    setFocusMessageId,
    setPendingMessageAreaFocus,
    setPendingMessagePageNavigation,
    setPendingRevealTarget,
    setPendingSearchNavigation,
    setSessionPage,
  ]);

  const clearBookmarkReturnSelection = useCallback(() => {
    setBookmarkReturnSelection(null);
  }, [setBookmarkReturnSelection]);

  const selectProjectAllMessages = useCallback(
    (
      projectId: string,
      { commitMode = "immediate", waitForKeyboardIdle = false }: HistorySelectionOptions = {},
    ) => {
      resetHistorySelectionState();
      if (historyVisualization !== "bookmarks") {
        clearBookmarkReturnSelection();
      }
      setHistorySelection(
        createHistorySelection(
          historyVisualization === "bookmarks" ? "bookmarks" : "project_all",
          projectId,
          "",
        ),
        {
          commitMode,
          waitForKeyboardIdle,
        },
      );
    },
    [
      clearBookmarkReturnSelection,
      historyVisualization,
      resetHistorySelectionState,
      setHistorySelection,
    ],
  );

  const selectBookmarksView = useCallback(
    ({ commitMode = "immediate", waitForKeyboardIdle = false }: HistorySelectionOptions = {}) => {
      resetHistorySelectionState();
      setBookmarkReturnSelection((current) => (historyMode === "bookmarks" ? current : selection));
      setHistoryVisualization("bookmarks");
      setHistorySelection(createHistorySelection("bookmarks", selectedProjectId, ""), {
        commitMode,
        waitForKeyboardIdle,
      });
    },
    [
      historyMode,
      resetHistorySelectionState,
      selectedProjectId,
      selection,
      setBookmarkReturnSelection,
      setHistorySelection,
      setHistoryVisualization,
    ],
  );

  const openProjectBookmarksView = useCallback(
    (
      projectId: string,
      { commitMode = "immediate", waitForKeyboardIdle = false }: HistorySelectionOptions = {},
    ) => {
      if (!projectId) {
        return;
      }
      resetHistorySelectionState();
      setBookmarkReturnSelection((current) => (historyMode === "bookmarks" ? current : selection));
      setHistoryVisualization("bookmarks");
      setHistorySelection(createHistorySelection("bookmarks", projectId, ""), {
        commitMode,
        waitForKeyboardIdle,
      });
    },
    [
      historyMode,
      resetHistorySelectionState,
      selection,
      setBookmarkReturnSelection,
      setHistorySelection,
      setHistoryVisualization,
    ],
  );

  const closeBookmarksView = useCallback(() => {
    resetHistorySelectionState();
    const nextSelection =
      bookmarkReturnSelection ?? createHistorySelection("project_all", selectedProjectId, "");
    setBookmarkReturnSelection(null);
    setHistorySelection(nextSelection, { commitMode: "immediate" });
  }, [
    bookmarkReturnSelection,
    resetHistorySelectionState,
    selectedProjectId,
    setBookmarkReturnSelection,
    setHistorySelection,
  ]);

  const selectSessionView = useCallback(
    (
      sessionId: string,
      projectId = selectedProjectId,
      { commitMode = "immediate", waitForKeyboardIdle = false }: HistorySelectionOptions = {},
    ) => {
      resetHistorySelectionState();
      if (historyVisualization !== "bookmarks") {
        clearBookmarkReturnSelection();
      }
      setHistorySelection(
        createHistorySelection(
          historyVisualization === "bookmarks" ? "bookmarks" : "session",
          projectId,
          sessionId,
        ),
        {
          commitMode,
          waitForKeyboardIdle,
        },
      );
    },
    [
      clearBookmarkReturnSelection,
      historyVisualization,
      resetHistorySelectionState,
      selectedProjectId,
      setHistorySelection,
    ],
  );

  const selectProjectTargetWithCommitMode = useCallback(
    (
      target: ReturnType<typeof getAdjacentVisibleProjectTarget>,
      { preserveFocus = false }: AdjacentSelectionOptions = {},
    ) => {
      if (!target) {
        return;
      }
      setTreeFocusedRow(
        target.kind === "session"
          ? { kind: "session", id: target.id, projectId: target.projectId }
          : target.kind === "folder"
            ? { kind: "folder", id: target.id }
            : { kind: "project", id: target.id },
      );
      const commitMode = target.kind === "session" ? "debounced_session" : "debounced_project";
      if (!preserveFocus) {
        pendingProjectPaneFocusCommitModeRef.current = commitMode;
        pendingProjectPaneFocusWaitForKeyboardIdleRef.current = true;
        focusVisibleProjectTarget(projectListRef.current, target.element);
        return;
      }
      if (target.kind === "project") {
        selectProjectAllMessages(target.id, { commitMode, waitForKeyboardIdle: true });
        return;
      }
      if (target.kind === "session") {
        selectSessionView(target.id, target.projectId, {
          commitMode,
          waitForKeyboardIdle: true,
        });
        return;
      }
      queueProjectTreeNoopCommit({ commitMode, waitForKeyboardIdle: true });
    },
    [
      pendingProjectPaneFocusCommitModeRef,
      pendingProjectPaneFocusWaitForKeyboardIdleRef,
      projectListRef,
      queueProjectTreeNoopCommit,
      selectProjectAllMessages,
      selectSessionView,
      setTreeFocusedRow,
    ],
  );

  const getCurrentProjectNavigationTarget = useCallback((): ProjectNavigationTarget | null => {
    const focusedTarget = getProjectNavigationTargetFromElement(
      document.activeElement instanceof HTMLElement ? document.activeElement : null,
    );
    if (focusedTarget) {
      return focusedTarget;
    }
    if (projectViewMode === "tree" && treeFocusedRow) {
      return treeFocusedRow;
    }
    return (
      getProjectNavigationTargetFromContainer(projectListRef.current) ??
      (selectedProjectId ? { kind: "project", id: selectedProjectId } : null)
    );
  }, [projectListRef, projectViewMode, selectedProjectId, treeFocusedRow]);

  const getAdjacentTreeProjectTarget = useCallback(
    (
      currentTarget: ProjectNavigationTarget | null,
      direction: Direction,
    ): ReturnType<typeof getAdjacentVisibleProjectTarget> => {
      const container = projectListRef.current;
      if (!container) {
        return null;
      }

      if (direction === "next" && currentTarget?.kind === "folder") {
        const folderElement = container.querySelector<HTMLElement>(
          `[data-project-nav-kind="folder"][data-folder-id="${CSS.escape(currentTarget.id)}"]`,
        );
        const isExpanded = folderElement?.getAttribute("aria-expanded") === "true";
        if (folderElement && !isExpanded) {
          const toggle = container.querySelector<HTMLElement>(
            `[data-project-expand-toggle-for="${CSS.escape(currentTarget.id)}"]`,
          );
          flushSync(() => {
            toggle?.click();
          });

          const firstProjectId = folderElement.dataset.folderFirstProjectId ?? "";
          if (firstProjectId) {
            const firstProjectElement = container.querySelector<HTMLElement>(
              `[data-project-nav-kind="project"][data-project-nav-id="${CSS.escape(firstProjectId)}"]`,
            );
            if (firstProjectElement) {
              return {
                kind: "project",
                id: firstProjectId,
                element: firstProjectElement,
              };
            }
          }
        }
      }

      return getAdjacentVisibleProjectTarget(container, currentTarget, direction);
    },
    [projectListRef],
  );

  const selectAdjacentSession = useCallback(
    (direction: Direction, { preserveFocus = false }: AdjacentSelectionOptions = {}) => {
      const currentNavigationId =
        historyMode === "project_all"
          ? PROJECT_ALL_NAV_ID
          : historyMode === "bookmarks"
            ? BOOKMARKS_NAV_ID
            : selectedSessionId;
      const nextNavigationId = getAdjacentItemId(
        sessionPaneNavigationItems,
        currentNavigationId,
        direction,
      );
      if (!nextNavigationId) {
        return;
      }
      if (!preserveFocus) {
        focusSessionPane();
      }
      if (nextNavigationId === PROJECT_ALL_NAV_ID) {
        selectProjectAllMessages(selectedProjectId, {
          commitMode: "debounced_session",
          waitForKeyboardIdle: true,
        });
        return;
      }
      if (nextNavigationId === BOOKMARKS_NAV_ID) {
        selectBookmarksView({ commitMode: "debounced_session", waitForKeyboardIdle: true });
        return;
      }
      selectSessionView(nextNavigationId, selectedProjectId, {
        commitMode: "debounced_session",
        waitForKeyboardIdle: true,
      });
    },
    [
      focusSessionPane,
      historyMode,
      selectedProjectId,
      selectedSessionId,
      selectBookmarksView,
      selectProjectAllMessages,
      selectSessionView,
      sessionPaneNavigationItems,
    ],
  );

  const selectAdjacentProject = useCallback(
    (direction: Direction, { preserveFocus = false }: AdjacentSelectionOptions = {}) => {
      if (projectViewMode === "list") {
        const currentTarget = getCurrentProjectNavigationTarget();
        const currentProjectId =
          currentTarget?.kind === "project" ? currentTarget.id : selectedProjectId;
        const nextProjectId = getAdjacentItemId(sortedProjects, currentProjectId, direction);
        if (!nextProjectId) {
          return;
        }

        if (preserveFocus) {
          selectProjectAllMessages(nextProjectId, {
            commitMode: "debounced_project",
            waitForKeyboardIdle: true,
          });
          return;
        }

        pendingProjectPaneFocusCommitModeRef.current = "debounced_project";
        pendingProjectPaneFocusWaitForKeyboardIdleRef.current = true;
        const container = projectListRef.current;
        if (!container) {
          return;
        }

        const selector = `[data-project-nav-kind="project"][data-project-nav-id="${CSS.escape(nextProjectId)}"]`;
        const targetElement = container.querySelector<HTMLElement>(selector);
        if (targetElement) {
          focusVisibleProjectTarget(container, targetElement);
        }
        return;
      }

      const currentTarget = getCurrentProjectNavigationTarget();
      const visibleTarget = preserveFocus
        ? getAdjacentTreeProjectTarget(currentTarget, direction)
        : getAdjacentVisibleProjectTarget(projectListRef.current, currentTarget, direction);
      if (!visibleTarget) {
        return;
      }

      selectProjectTargetWithCommitMode(visibleTarget, { preserveFocus });
    },
    [
      getAdjacentTreeProjectTarget,
      getCurrentProjectNavigationTarget,
      pendingProjectPaneFocusCommitModeRef,
      pendingProjectPaneFocusWaitForKeyboardIdleRef,
      projectListRef,
      projectViewMode,
      selectProjectAllMessages,
      selectProjectTargetWithCommitMode,
      selectedProjectId,
      sortedProjects,
    ],
  );

  const handleProjectTreeArrow = useCallback(
    (direction: "left" | "right") => {
      const container = projectListRef.current;
      if (!container) {
        return;
      }
      const currentTarget = getCurrentProjectNavigationTarget();
      if (!currentTarget) {
        return;
      }

      if (currentTarget.kind === "folder") {
        const folderElement = container.querySelector<HTMLButtonElement>(
          `[data-project-nav-kind="folder"][data-folder-id="${CSS.escape(currentTarget.id)}"]`,
        );
        if (!folderElement) {
          return;
        }
        const folderToggleElement = container.querySelector<HTMLElement>(
          `[data-project-expand-toggle-for="${CSS.escape(currentTarget.id)}"]`,
        );
        const expanded = folderElement.getAttribute("aria-expanded") === "true";
        if (direction === "right" && !expanded) {
          flushSync(() => {
            folderToggleElement?.click();
          });
          focusVisibleProjectTarget(container, folderElement);
          return;
        }
        if (direction === "left" && expanded) {
          flushSync(() => {
            folderToggleElement?.click();
          });
          focusVisibleProjectTarget(container, folderElement);
          return;
        }
        if (direction === "right" && expanded) {
          const childTarget = getAdjacentVisibleProjectTarget(container, currentTarget, "next");
          if (childTarget) {
            selectProjectTargetWithCommitMode(childTarget);
          }
        }
        return;
      }

      if (currentTarget.kind === "session") {
        if (direction === "left") {
          const projectElement = container.querySelector<HTMLButtonElement>(
            `[data-project-nav-kind="project"][data-project-nav-id="${CSS.escape(currentTarget.projectId)}"]`,
          );
          if (!projectElement) {
            return;
          }
          pendingProjectPaneFocusCommitModeRef.current = "debounced_project";
          pendingProjectPaneFocusWaitForKeyboardIdleRef.current = true;
          focusVisibleProjectTarget(container, projectElement);
        }
        return;
      }

      const projectElement = container.querySelector<HTMLElement>(
        `[data-project-nav-kind="project"][data-project-nav-id="${CSS.escape(currentTarget.id)}"]`,
      );
      const expanded = projectElement?.getAttribute("aria-expanded") === "true";
      const canExpand = projectElement?.dataset.projectCanExpand === "true";
      const toggle = container.querySelector<HTMLElement>(
        `[data-project-expand-toggle-for="${CSS.escape(currentTarget.id)}"]`,
      );

      if (direction === "right" && canExpand && !expanded) {
        flushSync(() => {
          toggle?.click();
        });
        focusVisibleProjectTarget(container, projectElement);
        return;
      }
      if (direction === "left" && canExpand && expanded) {
        flushSync(() => {
          toggle?.click();
        });
        focusVisibleProjectTarget(container, projectElement);
        return;
      }
      if (direction === "right" && expanded) {
        const childTarget = getAdjacentVisibleProjectTarget(container, currentTarget, "next");
        if (!childTarget) {
          return;
        }
        selectProjectTargetWithCommitMode(childTarget);
        return;
      }
      if (direction === "left") {
        const parentFolder = getProjectParentFolderTarget(container, currentTarget.id);
        if (!parentFolder || parentFolder.kind !== "folder") {
          return;
        }
        selectProjectTargetWithCommitMode(parentFolder);
      }
    },
    [
      getCurrentProjectNavigationTarget,
      pendingProjectPaneFocusCommitModeRef,
      pendingProjectPaneFocusWaitForKeyboardIdleRef,
      projectListRef,
      selectProjectTargetWithCommitMode,
    ],
  );

  const handleProjectTreeEnter = useCallback(() => {
    const container = projectListRef.current;
    if (!container) {
      return;
    }
    const currentTarget = getCurrentProjectNavigationTarget();
    if (!currentTarget) {
      return;
    }

    if (currentTarget.kind === "folder") {
      const folderElement = container.querySelector<HTMLButtonElement>(
        `[data-project-nav-kind="folder"][data-folder-id="${CSS.escape(currentTarget.id)}"]`,
      );
      folderElement?.click();
      return;
    }

    if (currentTarget.kind === "project") {
      const projectElement = container.querySelector<HTMLElement>(
        `[data-project-nav-kind="project"][data-project-nav-id="${CSS.escape(currentTarget.id)}"]`,
      );
      const canExpand = projectElement?.dataset.projectCanExpand === "true";
      if (!canExpand) {
        return;
      }
      const toggle = container.querySelector<HTMLElement>(
        `[data-project-expand-toggle-for="${CSS.escape(currentTarget.id)}"]`,
      );
      toggle?.click();
    }
  }, [getCurrentProjectNavigationTarget, projectListRef]);

  return {
    selectProjectAllMessages,
    selectBookmarksView,
    openProjectBookmarksView,
    closeBookmarksView,
    selectSessionView,
    selectAdjacentSession,
    selectAdjacentProject,
    handleProjectTreeArrow,
    handleProjectTreeEnter,
  };
}
