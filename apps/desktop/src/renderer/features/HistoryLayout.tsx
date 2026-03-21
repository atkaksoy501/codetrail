import type { Dispatch, SetStateAction } from "react";

import { ProjectPane } from "../components/history/ProjectPane";
import { SessionPane } from "../components/history/SessionPane";
import { copyTextToClipboard } from "../lib/clipboard";
import { openInFileManager, openPath } from "../lib/pathActions";
import { HistoryDetailPane } from "./HistoryDetailPane";
import { formatProjectDetails, formatSessionDetails } from "./historyCopyFormat";
import type { useHistoryController } from "./useHistoryController";

type HistoryController = ReturnType<typeof useHistoryController>;

export function HistoryLayout({
  history,
  advancedSearchEnabled,
  setAdvancedSearchEnabled,
  zoomPercent,
  canZoomIn,
  canZoomOut,
  applyZoomAction,
  setZoomPercent,
  logError,
  onDeleteProject,
  onDeleteSession,
}: {
  history: HistoryController;
  advancedSearchEnabled: boolean;
  setAdvancedSearchEnabled: Dispatch<SetStateAction<boolean>>;
  zoomPercent: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  applyZoomAction: (action: "in" | "out" | "reset") => Promise<void>;
  setZoomPercent: (percent: number) => Promise<void>;
  logError: (context: string, error: unknown) => void;
  onDeleteProject: (projectId?: string) => void;
  onDeleteSession: (sessionId?: string) => void;
}) {
  return (
    <>
      <ProjectPane
        sortedProjects={history.sortedProjects}
        selectedProjectId={history.selectedProjectId}
        listRef={history.refs.projectListRef}
        sortDirection={history.projectSortDirection}
        collapsed={history.projectPaneCollapsed}
        projectQueryInput={history.projectQueryInput}
        projectProviders={history.projectProviders}
        providers={history.enabledProviders}
        projectProviderCounts={history.projectProviderCounts}
        projectUpdates={history.projectUpdates}
        onToggleCollapsed={() => history.setProjectPaneCollapsed((value) => !value)}
        onProjectQueryChange={history.setProjectQueryInput}
        onToggleProvider={(provider) =>
          history.setProjectProviders((value) => {
            const next = value.includes(provider)
              ? value.filter((candidate) => candidate !== provider)
              : [...value, provider];
            return next;
          })
        }
        onToggleSortDirection={() =>
          history.setProjectSortDirection((value) => (value === "asc" ? "desc" : "asc"))
        }
        onCopyProjectDetails={(projectId) => {
          if (!projectId) {
            void history.handleCopyProjectDetails();
            return;
          }
          const project = history.sortedProjects.find((candidate) => candidate.id === projectId);
          if (!project) {
            return;
          }
          void copyTextToClipboard(formatProjectDetails(project)).then((copied) => {
            if (!copied) {
              logError("Failed copying project details", "Clipboard API unavailable");
            }
          });
        }}
        onSelectProject={history.selectProjectAllMessages}
        onDeleteProject={onDeleteProject}
        onOpenProjectLocation={(projectId) => {
          const targetProjectId = projectId || history.selectedProjectId;
          const project = history.sortedProjects.find(
            (candidate) => candidate.id === targetProjectId,
          );
          if (!project?.path?.trim()) {
            return;
          }
          void openInFileManager(history.sortedProjects, targetProjectId).then((result) => {
            if (!result.ok) {
              logError("Failed opening project location", result.error ?? "Unknown error");
            }
          });
        }}
        canCopyProjectDetails={Boolean(history.selectedProject)}
        canOpenProjectLocation={Boolean(history.selectedProject?.path?.trim())}
        canDeleteProject={Boolean(history.selectedProject)}
      />

      <div className="pane-resizer" onPointerDown={history.beginResize("project")} />

      <SessionPane
        sortedSessions={history.visibleSessionPaneSessions}
        selectedSessionId={history.selectedSessionId}
        listRef={history.refs.sessionListRef}
        sortDirection={history.sessionSortDirection}
        allSessionsCount={history.visibleSessionPaneAllSessionsCount}
        allSessionsSelected={history.historyMode === "project_all"}
        bookmarksCount={history.visibleSessionPaneBookmarksCount}
        bookmarksSelected={history.historyMode === "bookmarks"}
        collapsed={history.sessionPaneCollapsed}
        canCopySession={history.historyMode === "session" && !!history.selectedSession}
        canOpenSessionLocation={
          history.historyMode === "session" && Boolean(history.selectedSession?.filePath?.trim())
        }
        canDeleteSession={history.historyMode === "session" && !!history.selectedSession}
        onToggleCollapsed={() => history.setSessionPaneCollapsed((value) => !value)}
        onToggleSortDirection={() =>
          history.setSessionSortDirection((value) => (value === "asc" ? "desc" : "asc"))
        }
        onCopySession={(sessionId) => {
          if (!sessionId) {
            void history.handleCopySessionDetails();
            return;
          }
          const session = history.sortedSessions.find((candidate) => candidate.id === sessionId);
          if (!session) {
            return;
          }
          const project =
            history.sortedProjects.find((candidate) => candidate.id === session.projectId) ?? null;
          void copyTextToClipboard(
            formatSessionDetails(session, {
              projectLabel: project?.name || project?.path || "(unknown project)",
            }),
          ).then((copied) => {
            if (!copied) {
              logError("Failed copying session details", "Clipboard API unavailable");
            }
          });
        }}
        onDeleteSession={onDeleteSession}
        onOpenSessionLocation={(sessionId) => {
          const targetSessionId = sessionId || history.selectedSessionId;
          const session = history.sortedSessions.find(
            (candidate) => candidate.id === targetSessionId,
          );
          if (!session?.filePath?.trim()) {
            return;
          }
          void openPath(session.filePath).then((result) => {
            if (!result.ok) {
              logError("Failed opening session location", result.error ?? "Unknown error");
            }
          });
        }}
        onSelectAllSessions={() => {
          history.selectProjectAllMessages(history.selectedProjectId);
        }}
        onSelectBookmarks={history.selectBookmarksView}
        onSelectSession={history.selectSessionView}
      />

      <div className="pane-resizer" onPointerDown={history.beginResize("session")} />

      <section className="pane content-pane history-focus-pane">
        <HistoryDetailPane
          history={history}
          advancedSearchEnabled={advancedSearchEnabled}
          setAdvancedSearchEnabled={setAdvancedSearchEnabled}
          zoomPercent={zoomPercent}
          canZoomIn={canZoomIn}
          canZoomOut={canZoomOut}
          applyZoomAction={applyZoomAction}
          setZoomPercent={setZoomPercent}
        />
      </section>
    </>
  );
}
