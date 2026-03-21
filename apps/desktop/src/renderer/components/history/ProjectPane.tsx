import type { Provider } from "@codetrail/core/browser";
import { type Ref, useEffect, useRef, useState } from "react";

import type { ProjectSummary } from "../../app/types";
import { SEARCH_PLACEHOLDERS } from "../../lib/searchPlaceholders";
import { compactPath, formatDate, prettyProvider } from "../../lib/viewUtils";
import { ToolbarIcon } from "../ToolbarIcon";
import { HistoryListContextMenu } from "./HistoryListContextMenu";

export function ProjectPane({
  sortedProjects,
  selectedProjectId,
  sortDirection,
  collapsed,
  projectQueryInput,
  projectProviders,
  providers,
  projectProviderCounts,
  projectUpdates,
  onToggleCollapsed,
  onProjectQueryChange,
  onToggleProvider,
  onToggleSortDirection,
  onCopyProjectDetails,
  onSelectProject,
  onOpenProjectLocation,
  onDeleteProject,
  canCopyProjectDetails,
  canOpenProjectLocation,
  canDeleteProject,
  listRef,
}: {
  sortedProjects: ProjectSummary[];
  selectedProjectId: string;
  sortDirection: "asc" | "desc";
  collapsed: boolean;
  projectQueryInput: string;
  projectProviders: Provider[];
  providers: Provider[];
  projectProviderCounts: Record<Provider, number>;
  projectUpdates: Record<string, { messageDelta: number; updatedAt: number }>;
  onToggleCollapsed: () => void;
  onProjectQueryChange: (value: string) => void;
  onToggleProvider: (provider: Provider) => void;
  onToggleSortDirection: () => void;
  onCopyProjectDetails: (projectId?: string) => void;
  onSelectProject: (projectId: string) => void;
  onOpenProjectLocation: (projectId?: string) => void;
  onDeleteProject: (projectId?: string) => void;
  canCopyProjectDetails: boolean;
  canOpenProjectLocation: boolean;
  canDeleteProject: boolean;
  listRef?: Ref<HTMLDivElement>;
}) {
  const selectedProjectRef = useRef<HTMLButtonElement | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    projectId: string;
    x: number;
    y: number;
  } | null>(null);
  const sortTooltip =
    sortDirection === "asc"
      ? "Projects: oldest activity first. Click to show newest activity first."
      : "Projects: newest activity first. Click to show oldest activity first.";

  useEffect(() => {
    if (!selectedProjectId) {
      return;
    }
    selectedProjectRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [selectedProjectId]);

  return (
    <aside className={`panel history-focus-pane project-pane${collapsed ? " collapsed" : ""}`}>
      <div className="panel-header">
        <div className="panel-header-left">
          <span className="panel-title">Projects</span>
          <span className="panel-count">{sortedProjects.length}</span>
        </div>
        <div className="pane-head-controls">
          {!collapsed ? (
            <>
              <button
                type="button"
                className="collapse-btn sort-btn"
                onClick={onToggleSortDirection}
                aria-label={
                  sortDirection === "asc" ? "Sort projects descending" : "Sort projects ascending"
                }
                title={sortTooltip}
              >
                <ToolbarIcon name={sortDirection === "asc" ? "sortAsc" : "sortDesc"} />
              </button>
              <button
                type="button"
                className="collapse-btn"
                onClick={() => onCopyProjectDetails()}
                aria-label="Copy project details"
                title="Copy project details"
                disabled={!canCopyProjectDetails}
              >
                <ToolbarIcon name="copy" />
              </button>
              <button
                type="button"
                className="collapse-btn pane-delete-btn"
                onClick={() => onDeleteProject()}
                aria-label="Delete project from Code Trail"
                title="Delete project from Code Trail"
                disabled={!canDeleteProject}
              >
                <ToolbarIcon name="trash" />
              </button>
              <button
                type="button"
                className="collapse-btn pane-open-location-btn"
                onClick={() => onOpenProjectLocation()}
                aria-label="Open project folder"
                title="Open project folder"
                disabled={!canOpenProjectLocation}
              >
                <ToolbarIcon name="folderOpen" />
              </button>
            </>
          ) : null}
          <button
            type="button"
            className="collapse-btn pane-collapse-btn"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand Projects pane" : "Collapse Projects pane"}
            title={collapsed ? "Expand Projects (Cmd/Ctrl+B)" : "Collapse Projects (Cmd/Ctrl+B)"}
          >
            <ToolbarIcon name="chevronLeft" />
          </button>
        </div>
      </div>
      <div className="search-wrapper">
        <div className="search-box">
          <div className="search-input-shell">
            <ToolbarIcon name="search" />
            <input
              className="search-input"
              value={projectQueryInput}
              onChange={(event) => onProjectQueryChange(event.target.value)}
              placeholder={SEARCH_PLACEHOLDERS.sidebarProjects}
            />
          </div>
        </div>
      </div>
      <div className="tag-row">
        {providers.map((provider) => (
          <button
            key={provider}
            type="button"
            className={`tag tag-${provider}${projectProviders.includes(provider) ? " active" : ""}`}
            onClick={() => onToggleProvider(provider)}
          >
            {prettyProvider(provider)}
            <span className="count">{projectProviderCounts[provider]}</span>
          </button>
        ))}
      </div>
      <div className="list-scroll project-list" ref={listRef} tabIndex={-1}>
        {sortedProjects.map((project) => {
          const update = projectUpdates[project.id];
          return (
            <button
              key={project.id}
              type="button"
              ref={project.id === selectedProjectId ? selectedProjectRef : null}
              className={`list-item project-item${project.id === selectedProjectId ? " active" : ""}${
                update ? " recently-updated" : ""
              }`}
              onClick={() => {
                setContextMenu(null);
                onSelectProject(project.id);
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                onSelectProject(project.id);
                setContextMenu({
                  projectId: project.id,
                  x: event.clientX,
                  y: event.clientY,
                });
              }}
            >
              <div className="list-item-name">
                {project.id === selectedProjectId ? <span className="active-dot" /> : null}
                <span className="project-item-label">
                  {project.name || project.path || "(no project path)"}
                </span>
                <span
                  className={`project-update-badge${update ? " visible" : ""}`}
                  aria-label={update ? `${update.messageDelta} new messages` : undefined}
                >
                  {update ? `+${update.messageDelta}` : "+0"}
                </span>
              </div>
              <div className="list-item-path">{compactPath(project.path)}</div>
              <div className="list-item-meta">
                <span className={`meta-tag ${project.provider}`}>
                  {prettyProvider(project.provider)}
                </span>{" "}
                <span className="sessions-count">
                  {project.sessionCount} {project.sessionCount === 1 ? "session" : "sessions"}
                </span>
                <span className="dot-sep" />
                <span>{formatDate(project.lastActivity)}</span>
              </div>
            </button>
          );
        })}
      </div>
      <HistoryListContextMenu
        open={Boolean(contextMenu)}
        x={contextMenu?.x ?? 0}
        y={contextMenu?.y ?? 0}
        onClose={() => setContextMenu(null)}
        groups={
          contextMenu
            ? [
                [
                  {
                    id: "copy-project",
                    label: "Copy",
                    icon: "copy",
                    onSelect: () => onCopyProjectDetails(contextMenu.projectId),
                  },
                  {
                    id: "open-project-folder",
                    label: "Open Folder",
                    icon: "folderOpen",
                    onSelect: () => onOpenProjectLocation(contextMenu.projectId),
                  },
                ],
                [
                  {
                    id: "delete-project",
                    label: "Delete",
                    icon: "trash",
                    tone: "danger",
                    onSelect: () => onDeleteProject(contextMenu.projectId),
                  },
                ],
              ]
            : []
        }
      />
    </aside>
  );
}
