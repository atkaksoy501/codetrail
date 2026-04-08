import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";

import type { Provider } from "@codetrail/core/browser";

import type {
  HistorySelection,
  HistorySelectionCommitMode,
  PaneStateSnapshot,
  ProjectSortField,
  ProjectSummary,
  ProjectViewMode,
  SessionSummary,
  SortDirection,
  TreeAutoRevealSessionRequest,
} from "../app/types";
import { useProjectPaneTreeState } from "../components/history/useProjectPaneTreeState";
import type { CodetrailClient } from "../lib/codetrailClient";
import {
  type StableListUpdateSource,
  mergeStableOrder,
  reorderItemsByStableOrder,
} from "../lib/projectUpdates";
import { compareRecent, sessionActivityOf } from "../lib/viewUtils";

type ProjectUpdateState = {
  messageDelta: number;
  updatedAt: number;
};

const PROJECT_UPDATE_HIGHLIGHT_MS = 8_000;
const PROJECT_NAME_COLLATOR = new Intl.Collator(undefined, {
  sensitivity: "base",
  numeric: true,
});

function getProjectSortLabel(project: ProjectSummary): string {
  return project.name.trim() || project.path.trim() || project.id;
}

function compareProjectName(left: ProjectSummary, right: ProjectSummary): number {
  return PROJECT_NAME_COLLATOR.compare(getProjectSortLabel(left), getProjectSortLabel(right));
}

function compareProjectsByField(
  left: ProjectSummary,
  right: ProjectSummary,
  sortField: ProjectSortField,
): number {
  if (sortField === "name") {
    return (
      compareProjectName(left, right) ||
      compareRecent(left.lastActivity, right.lastActivity) ||
      left.id.localeCompare(right.id)
    );
  }

  return (
    compareRecent(left.lastActivity, right.lastActivity) ||
    compareProjectName(left, right) ||
    left.id.localeCompare(right.id)
  );
}

function sortSessionSummaries(
  sessions: SessionSummary[],
  sortDirection: SortDirection,
): SessionSummary[] {
  const next = [...sessions];
  next.sort((left, right) => {
    const byRecent =
      compareRecent(sessionActivityOf(left), sessionActivityOf(right)) ||
      left.messageCount - right.messageCount ||
      left.id.localeCompare(right.id);
    return sortDirection === "asc" ? byRecent : -byRecent;
  });
  return next;
}

function areStableOrderMapsEqual(
  current: Record<string, string[]>,
  next: Record<string, string[]>,
): boolean {
  const currentProjectIds = Object.keys(current);
  const nextProjectIds = Object.keys(next);
  if (currentProjectIds.length !== nextProjectIds.length) {
    return false;
  }

  return nextProjectIds.every((projectId) => {
    const currentIds = current[projectId];
    const nextIds = next[projectId] ?? [];
    return (
      currentIds !== undefined &&
      currentIds.length === nextIds.length &&
      currentIds.every((id, index) => id === nextIds[index])
    );
  });
}

export function useHistoryCatalogController({
  initialPaneState,
  codetrail,
  logError,
  enabledProviders,
  projectProviders,
  projectQuery,
  projectQueryInput,
  projectSortField,
  projectSortDirection,
  sessionSortDirection,
  uiSelection,
  committedSelection,
  projectViewMode,
  autoRevealSessionRequest,
  setAutoRevealSessionRequest,
  pendingProjectPaneFocusCommitModeRef,
  pendingProjectPaneFocusWaitForKeyboardIdleRef,
  queueSelectionNoopCommit,
}: {
  initialPaneState: PaneStateSnapshot | null | undefined;
  codetrail: CodetrailClient;
  logError: (context: string, error: unknown) => void;
  enabledProviders: Provider[];
  projectProviders: Provider[];
  projectQuery: string;
  projectQueryInput: string;
  projectSortField: ProjectSortField;
  projectSortDirection: SortDirection;
  sessionSortDirection: SortDirection;
  uiSelection: HistorySelection;
  committedSelection: HistorySelection;
  projectViewMode: ProjectViewMode;
  autoRevealSessionRequest: TreeAutoRevealSessionRequest | null;
  setAutoRevealSessionRequest: Dispatch<SetStateAction<TreeAutoRevealSessionRequest | null>>;
  pendingProjectPaneFocusCommitModeRef: MutableRefObject<HistorySelectionCommitMode>;
  pendingProjectPaneFocusWaitForKeyboardIdleRef: MutableRefObject<boolean>;
  queueSelectionNoopCommit: (
    commitMode?: HistorySelectionCommitMode,
    waitForKeyboardIdle?: boolean,
  ) => void;
}) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectListUpdateSource, setProjectListUpdateSource] =
    useState<StableListUpdateSource>("resort");
  const [projectOrderIds, setProjectOrderIds] = useState<string[]>([]);
  const [projectUpdates, setProjectUpdates] = useState<Record<string, ProjectUpdateState>>({});
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionListUpdateSource, setSessionListUpdateSource] =
    useState<StableListUpdateSource>("resort");
  const [sessionOrderIds, setSessionOrderIds] = useState<string[]>([]);
  const [treeProjectSessionsByProjectId, setTreeProjectSessionsByProjectId] = useState<
    Record<string, SessionSummary[]>
  >({});
  const [
    treeProjectSessionsUpdateSourceByProjectId,
    setTreeProjectSessionsUpdateSourceByProjectId,
  ] = useState<Record<string, StableListUpdateSource>>({});
  const [treeProjectSessionOrderIdsByProjectId, setTreeProjectSessionOrderIdsByProjectId] =
    useState<Record<string, string[]>>({});
  const [treeProjectSessionsLoadingByProjectId, setTreeProjectSessionsLoadingByProjectId] =
    useState<Record<string, boolean>>({});
  const [sessionsLoadedProjectId, setSessionsLoadedProjectId] = useState<string | null>(null);

  const treeProjectSessionsLoadTokenRef = useRef<Record<string, number>>({});
  const treeProjectSessionsByProjectIdRef = useRef<Record<string, SessionSummary[]>>({});
  const treeProjectSessionsLoadingByProjectIdRef = useRef<Record<string, boolean>>({});
  const projectsRef = useRef<ProjectSummary[]>([]);
  const projectUpdateTimeoutsRef = useRef<Map<string, number>>(new Map());
  const projectOrderControlKeyRef = useRef("");
  const sessionOrderControlKeyRef = useRef("");
  const treeSessionOrderControlKeyRef = useRef("");

  const projectsLoadTokenRef = useRef(0);
  const sessionsLoadTokenRef = useRef(0);

  const naturallySortedProjects = useMemo(() => {
    const next = projects.filter((project) => enabledProviders.includes(project.provider));
    next.sort((left, right) => {
      const naturalOrder = compareProjectsByField(left, right, projectSortField);
      return projectSortDirection === "asc" ? naturalOrder : -naturalOrder;
    });
    return next;
  }, [enabledProviders, projectSortDirection, projectSortField, projects]);

  const projectOrderControlKey = useMemo(
    () =>
      [
        projectSortDirection,
        projectSortField,
        enabledProviders.join(","),
        projectProviders.join(","),
        projectQuery,
      ].join("\u0000"),
    [enabledProviders, projectProviders, projectQuery, projectSortDirection, projectSortField],
  );

  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  useEffect(() => {
    const nextIds = naturallySortedProjects.map((project) => project.id);
    const didProjectControlsChange = projectOrderControlKeyRef.current !== projectOrderControlKey;
    projectOrderControlKeyRef.current = projectOrderControlKey;

    setProjectOrderIds((current) => {
      if (didProjectControlsChange || projectListUpdateSource !== "auto" || current.length === 0) {
        return nextIds;
      }
      return mergeStableOrder(current, nextIds);
    });
  }, [naturallySortedProjects, projectListUpdateSource, projectOrderControlKey]);

  const sortedProjects = useMemo(
    () => reorderItemsByStableOrder(naturallySortedProjects, projectOrderIds),
    [naturallySortedProjects, projectOrderIds],
  );

  const selectedProjectId = committedSelection.projectId || sortedProjects[0]?.id || "";
  const uiSelectedProjectId = uiSelection.projectId || sortedProjects[0]?.id || "";
  const selectedSessionId =
    "sessionId" in committedSelection ? (committedSelection.sessionId ?? "") : "";
  const uiSelectedSessionId = "sessionId" in uiSelection ? (uiSelection.sessionId ?? "") : "";

  const naturallySortedSessions = useMemo(
    () => sortSessionSummaries(sessions, sessionSortDirection),
    [sessionSortDirection, sessions],
  );
  const sessionOrderControlKey = useMemo(
    () => [selectedProjectId, sessionSortDirection].join("\u0000"),
    [selectedProjectId, sessionSortDirection],
  );

  useEffect(() => {
    const nextIds = naturallySortedSessions.map((session) => session.id);
    const didSessionControlsChange = sessionOrderControlKeyRef.current !== sessionOrderControlKey;
    sessionOrderControlKeyRef.current = sessionOrderControlKey;

    setSessionOrderIds((current) => {
      if (didSessionControlsChange || sessionListUpdateSource !== "auto" || current.length === 0) {
        return nextIds;
      }
      return mergeStableOrder(current, nextIds);
    });
  }, [naturallySortedSessions, sessionListUpdateSource, sessionOrderControlKey]);

  const sortedSessions = useMemo(
    () => reorderItemsByStableOrder(naturallySortedSessions, sessionOrderIds),
    [naturallySortedSessions, sessionOrderIds],
  );

  const naturallySortedTreeProjectSessionsByProjectId = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(treeProjectSessionsByProjectId).map(([projectId, projectSessions]) => [
          projectId,
          sortSessionSummaries(projectSessions, sessionSortDirection),
        ]),
      ) as Record<string, SessionSummary[]>,
    [sessionSortDirection, treeProjectSessionsByProjectId],
  );

  useEffect(() => {
    const didTreeSessionControlsChange =
      treeSessionOrderControlKeyRef.current !== sessionSortDirection;
    treeSessionOrderControlKeyRef.current = sessionSortDirection;

    setTreeProjectSessionOrderIdsByProjectId((current) => {
      const next = Object.fromEntries(
        Object.entries(naturallySortedTreeProjectSessionsByProjectId).map(
          ([projectId, projectSessions]) => {
            const nextIds = projectSessions.map((session) => session.id);
            const currentIds = current[projectId] ?? [];
            const updateSource = treeProjectSessionsUpdateSourceByProjectId[projectId] ?? "resort";
            if (
              didTreeSessionControlsChange ||
              updateSource !== "auto" ||
              currentIds.length === 0
            ) {
              return [projectId, nextIds];
            }
            return [projectId, mergeStableOrder(currentIds, nextIds)];
          },
        ),
      ) as Record<string, string[]>;
      return areStableOrderMapsEqual(current, next) ? current : next;
    });
  }, [
    naturallySortedTreeProjectSessionsByProjectId,
    sessionSortDirection,
    treeProjectSessionsUpdateSourceByProjectId,
  ]);

  const sortedTreeProjectSessionsByProjectId = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(naturallySortedTreeProjectSessionsByProjectId).map(
          ([projectId, projectSessions]) => [
            projectId,
            reorderItemsByStableOrder(
              projectSessions,
              treeProjectSessionOrderIdsByProjectId[projectId] ?? [],
            ),
          ],
        ),
      ) as Record<string, SessionSummary[]>,
    [naturallySortedTreeProjectSessionsByProjectId, treeProjectSessionOrderIdsByProjectId],
  );

  useEffect(() => {
    treeProjectSessionsByProjectIdRef.current = treeProjectSessionsByProjectId;
  }, [treeProjectSessionsByProjectId]);

  useEffect(() => {
    treeProjectSessionsLoadingByProjectIdRef.current = treeProjectSessionsLoadingByProjectId;
  }, [treeProjectSessionsLoadingByProjectId]);

  const queueProjectTreeNoopCommit = useCallback(
    ({
      commitMode = "immediate",
      waitForKeyboardIdle = false,
    }: {
      commitMode?: HistorySelectionCommitMode;
      waitForKeyboardIdle?: boolean;
    } = {}) => {
      pendingProjectPaneFocusCommitModeRef.current = "immediate";
      pendingProjectPaneFocusWaitForKeyboardIdleRef.current = false;
      queueSelectionNoopCommit(commitMode, waitForKeyboardIdle);
    },
    [
      pendingProjectPaneFocusCommitModeRef,
      pendingProjectPaneFocusWaitForKeyboardIdleRef,
      queueSelectionNoopCommit,
    ],
  );

  useEffect(() => {
    const visibleProjectIds = new Set(sortedProjects.map((project) => project.id));
    setTreeProjectSessionsByProjectId((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([projectId]) => visibleProjectIds.has(projectId)),
      ),
    );
    setTreeProjectSessionsLoadingByProjectId((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([projectId]) => visibleProjectIds.has(projectId)),
      ),
    );
    setTreeProjectSessionsUpdateSourceByProjectId((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([projectId]) => visibleProjectIds.has(projectId)),
      ),
    );
    setTreeProjectSessionOrderIdsByProjectId((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([projectId]) => visibleProjectIds.has(projectId)),
      ),
    );
  }, [sortedProjects]);

  const ensureTreeProjectSessionsLoaded = useCallback(
    async (projectId: string, source: StableListUpdateSource = "resort") => {
      if (
        !projectId ||
        treeProjectSessionsLoadingByProjectIdRef.current[projectId] ||
        treeProjectSessionsByProjectIdRef.current[projectId]
      ) {
        return;
      }

      const requestToken = (treeProjectSessionsLoadTokenRef.current[projectId] ?? 0) + 1;
      treeProjectSessionsLoadTokenRef.current[projectId] = requestToken;
      setTreeProjectSessionsLoadingByProjectId((current) => ({
        ...current,
        [projectId]: true,
      }));
      try {
        const response = await codetrail.invoke("sessions:list", { projectId });
        if (treeProjectSessionsLoadTokenRef.current[projectId] !== requestToken) {
          return;
        }
        setTreeProjectSessionsByProjectId((current) => ({
          ...current,
          [projectId]: response.sessions,
        }));
        setTreeProjectSessionsUpdateSourceByProjectId((current) => ({
          ...current,
          [projectId]: source,
        }));
      } catch (error) {
        logError("Failed loading tree sessions", error);
      } finally {
        if (treeProjectSessionsLoadTokenRef.current[projectId] === requestToken) {
          setTreeProjectSessionsLoadingByProjectId((current) => {
            const next = { ...current };
            delete next[projectId];
            return next;
          });
        }
      }
    },
    [codetrail, logError],
  );

  const refreshTreeProjectSessions = useCallback(
    async (source: StableListUpdateSource = "resort") => {
      const projectIds = Object.keys(treeProjectSessionsByProjectIdRef.current);
      if (projectIds.length === 0) {
        return;
      }
      try {
        const response = await codetrail.invoke("sessions:listMany", { projectIds });
        setTreeProjectSessionsByProjectId((current) => ({
          ...current,
          ...response.sessionsByProjectId,
        }));
        setTreeProjectSessionsUpdateSourceByProjectId((current) => ({
          ...current,
          ...Object.fromEntries(projectIds.map((projectId) => [projectId, source] as const)),
        }));
      } catch (error) {
        logError("Failed refreshing tree sessions", error);
      }
    },
    [codetrail, logError],
  );

  const projectProviderKey = useMemo(() => projectProviders.join(","), [projectProviders]);
  const {
    folderGroups,
    expandedFolderIdSet,
    expandedProjectIds,
    allVisibleFoldersExpanded,
    treeFocusedRow,
    setTreeFocusedRow,
    handleToggleFolder,
    handleToggleAllFolders,
    handleToggleProjectExpansion: toggleTreeProjectExpansion,
  } = useProjectPaneTreeState({
    sortedProjects,
    selectedProjectId: uiSelectedProjectId,
    selectedSessionId: uiSelectedSessionId,
    sortField: projectSortField,
    sortDirection: projectSortDirection,
    viewMode: projectViewMode,
    updateSource: projectListUpdateSource,
    historyMode: uiSelection.mode,
    projectProvidersKey: projectProviderKey,
    projectQueryInput,
    onEnsureTreeProjectSessionsLoaded: ensureTreeProjectSessionsLoaded,
    autoRevealSessionRequest,
    onConsumeAutoRevealSessionRequest: () => setAutoRevealSessionRequest(null),
  });

  const registerAutoProjectUpdates = useCallback((deltas: Record<string, number>) => {
    const entries = Object.entries(deltas).filter(([, delta]) => delta > 0);
    if (entries.length === 0) {
      return;
    }

    const now = Date.now();
    setProjectUpdates((current) => {
      const next = { ...current };
      for (const [projectId, delta] of entries) {
        const previousDelta = next[projectId]?.messageDelta ?? 0;
        next[projectId] = {
          messageDelta: previousDelta + delta,
          updatedAt: now,
        };
      }
      return next;
    });

    for (const [projectId] of entries) {
      const existingTimeoutId = projectUpdateTimeoutsRef.current.get(projectId);
      if (existingTimeoutId !== undefined) {
        window.clearTimeout(existingTimeoutId);
      }
      const timeoutId = window.setTimeout(() => {
        setProjectUpdates((current) => {
          if (!(projectId in current)) {
            return current;
          }
          const next = { ...current };
          delete next[projectId];
          return next;
        });
        projectUpdateTimeoutsRef.current.delete(projectId);
      }, PROJECT_UPDATE_HIGHLIGHT_MS);
      projectUpdateTimeoutsRef.current.set(projectId, timeoutId);
    }
  }, []);

  useEffect(() => {
    return () => {
      for (const timeoutId of projectUpdateTimeoutsRef.current.values()) {
        window.clearTimeout(timeoutId);
      }
      projectUpdateTimeoutsRef.current.clear();
    };
  }, []);

  return {
    projects,
    setProjects,
    projectsRef,
    projectsLoadTokenRef,
    projectsLoaded,
    setProjectsLoaded,
    projectListUpdateSource,
    setProjectListUpdateSource,
    projectUpdates,
    sessions,
    setSessions,
    sessionsLoadTokenRef,
    sessionsLoadedProjectId,
    setSessionsLoadedProjectId,
    sessionListUpdateSource,
    setSessionListUpdateSource,
    treeProjectSessionsByProjectIdRef,
    treeProjectSessionsByProjectId: sortedTreeProjectSessionsByProjectId,
    treeProjectSessionsLoadingByProjectId,
    sortedProjects,
    sortedSessions,
    selectedProjectId,
    uiSelectedProjectId,
    selectedSessionId,
    uiSelectedSessionId,
    queueProjectTreeNoopCommit,
    ensureTreeProjectSessionsLoaded,
    refreshTreeProjectSessions,
    registerAutoProjectUpdates,
    folderGroups,
    expandedFolderIdSet,
    expandedProjectIds,
    allVisibleFoldersExpanded,
    treeFocusedRow,
    setTreeFocusedRow,
    handleToggleFolder,
    handleToggleAllFolders,
    toggleTreeProjectExpansion,
  };
}
