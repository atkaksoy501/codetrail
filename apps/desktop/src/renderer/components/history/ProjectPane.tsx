import type { Provider } from "@codetrail/core/browser";
import { type Ref, useEffect, useMemo, useRef, useState } from "react";

import type { ProjectSortField, ProjectSummary, ProjectViewMode } from "../../app/types";
import { useClickOutside } from "../../hooks/useClickOutside";
import { buildProjectFolderGroups, getProjectGroupId } from "../../lib/projectTree";
import { mergeStableProjectOrder } from "../../lib/projectUpdates";
import { SEARCH_PLACEHOLDERS } from "../../lib/searchPlaceholders";
import { compactPath, formatDate, prettyProvider } from "../../lib/viewUtils";
import { ToolbarIcon } from "../ToolbarIcon";
import { HistoryListContextMenu } from "./HistoryListContextMenu";

const PROJECT_SORT_FIELD_LABELS: Record<ProjectSortField, string> = {
  last_active: "Last Active",
  name: "Name",
  sessions: "Sessions",
};

function ProjectPaneChevron({ open }: { open: boolean }) {
  return (
    <svg className="project-pane-inline-icon" viewBox="0 0 12 12" aria-hidden>
      <title>{open ? "Collapse folder" : "Expand folder"}</title>
      <path
        d={open ? "M3 4.5 6 7.5 9 4.5" : "M4.5 3 7.5 6 4.5 9"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProjectPaneDropdownChevron({ open }: { open: boolean }) {
  return (
    <svg className="project-pane-inline-icon" viewBox="0 0 12 12" aria-hidden>
      <title>{open ? "Close menu" : "Open menu"}</title>
      <path
        d={open ? "M3 7.5 6 4.5 9 7.5" : "M3 4.5 6 7.5 9 4.5"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProjectPaneSortFieldIcon() {
  return (
    <svg className="project-pane-inline-icon" viewBox="0 0 16 16" aria-hidden>
      <title>Sort field</title>
      <path
        d="M3 4.5h7M3 8h10M3 11.5h5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
      <path
        d="M11.5 3.75 13 5.25 14.5 3.75"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProjectPaneFolderIcon() {
  return (
    <svg className="project-pane-inline-icon" viewBox="0 0 16 16" aria-hidden>
      <title>Folder</title>
      <path
        d="M2.5 4.5v7a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1H8L6.8 4.2A1 1 0 0 0 6 3.8H3.5a1 1 0 0 0-1 0.7Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProjectPaneMenuIcon() {
  return (
    <svg className="project-pane-inline-icon" viewBox="0 0 16 16" aria-hidden>
      <title>More options</title>
      <circle cx="3.25" cy="8" r="1.1" fill="currentColor" />
      <circle cx="8" cy="8" r="1.1" fill="currentColor" />
      <circle cx="12.75" cy="8" r="1.1" fill="currentColor" />
    </svg>
  );
}

function ProjectPaneListIcon() {
  return (
    <svg className="project-pane-inline-icon" viewBox="0 0 16 16" aria-hidden>
      <title>List view</title>
      <path
        d="M4 4.5h8M4 8h8M4 11.5h8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ProjectPaneTreeIcon() {
  return (
    <svg className="project-pane-inline-icon" viewBox="0 0 16 16" aria-hidden>
      <title>By folder view</title>
      <path
        d="M3 4.5h4M3 11.5h4M7 4.5v7M7 8h6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function getProjectLabel(project: ProjectSummary): string {
  return project.name || project.path || "(no project path)";
}

export function ProjectPane({
  sortedProjects,
  selectedProjectId,
  sortField,
  sortDirection,
  viewMode,
  updateSource,
  collapsed,
  projectQueryInput,
  projectProviders,
  providers,
  projectProviderCounts,
  projectUpdates,
  onToggleCollapsed,
  onProjectQueryChange,
  onToggleProvider,
  onSetSortField,
  onToggleSortDirection,
  onToggleViewMode,
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
  sortField: ProjectSortField;
  sortDirection: "asc" | "desc";
  viewMode: ProjectViewMode;
  updateSource: "auto" | "resort";
  collapsed: boolean;
  projectQueryInput: string;
  projectProviders: Provider[];
  providers: Provider[];
  projectProviderCounts: Record<Provider, number>;
  projectUpdates: Record<string, { messageDelta: number; updatedAt: number }>;
  onToggleCollapsed: () => void;
  onProjectQueryChange: (value: string) => void;
  onToggleProvider: (provider: Provider) => void;
  onSetSortField: (value: ProjectSortField) => void;
  onToggleSortDirection: () => void;
  onToggleViewMode: () => void;
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
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const overflowMenuRef = useRef<HTMLDivElement | null>(null);
  const folderOrderControlKeyRef = useRef("");
  const folderExpansionResetKeyRef = useRef<string | null>(null);
  const seenFolderIdsRef = useRef<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{
    projectId: string;
    x: number;
    y: number;
  } | null>(null);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [overflowMenuOpen, setOverflowMenuOpen] = useState(false);
  const [folderOrderIds, setFolderOrderIds] = useState<string[]>([]);
  const [expandedFolderIds, setExpandedFolderIds] = useState<string[]>([]);
  const [treeFocusedRow, setTreeFocusedRow] = useState<{
    kind: "folder" | "project";
    id: string;
  } | null>(null);
  const sortLabel = PROJECT_SORT_FIELD_LABELS[sortField];
  const sortTooltip =
    sortDirection === "asc"
      ? `Projects sorted by ${sortLabel}, ascending. Click to show descending order.`
      : `Projects sorted by ${sortLabel}, descending. Click to show ascending order.`;
  const projectProviderKey = useMemo(() => projectProviders.join(","), [projectProviders]);
  const folderExpansionResetKey = useMemo(
    () => [sortField, sortDirection, projectProviderKey, projectQueryInput].join("\u0000"),
    [projectProviderKey, projectQueryInput, sortDirection, sortField],
  );
  const folderOrderControlKey = useMemo(
    () => [sortField, sortDirection, projectProviderKey, projectQueryInput].join("\u0000"),
    [projectProviderKey, projectQueryInput, sortDirection, sortField],
  );

  useClickOutside(sortMenuRef, sortMenuOpen, () => setSortMenuOpen(false));
  useClickOutside(overflowMenuRef, overflowMenuOpen, () => setOverflowMenuOpen(false));

  useEffect(() => {
    if (!selectedProjectId) {
      return;
    }
    selectedProjectRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [selectedProjectId]);

  useEffect(() => {
    if (viewMode !== "tree") {
      setTreeFocusedRow(null);
      return;
    }
    if (!selectedProjectId) {
      return;
    }
    setTreeFocusedRow((current) =>
      current?.kind === "folder"
        ? current
        : current?.kind === "project" && current.id === selectedProjectId
          ? current
          : { kind: "project", id: selectedProjectId },
    );
  }, [selectedProjectId, viewMode]);

  const naturalFolderGroups = useMemo(
    () => buildProjectFolderGroups(sortedProjects, sortField, sortDirection),
    [sortedProjects, sortDirection, sortField],
  );

  useEffect(() => {
    if (viewMode !== "tree") {
      folderExpansionResetKeyRef.current = null;
      seenFolderIdsRef.current.clear();
      setExpandedFolderIds([]);
      return;
    }
    if (folderExpansionResetKeyRef.current === folderExpansionResetKey) {
      return;
    }
    folderExpansionResetKeyRef.current = folderExpansionResetKey;
    seenFolderIdsRef.current.clear();
  }, [folderExpansionResetKey, viewMode]);

  useEffect(() => {
    if (viewMode !== "tree") {
      return;
    }

    const nextIds = naturalFolderGroups.map((group) => group.id);
    const didControlsChange = folderOrderControlKeyRef.current !== folderOrderControlKey;
    folderOrderControlKeyRef.current = folderOrderControlKey;

    setFolderOrderIds((current) => {
      if (didControlsChange || updateSource !== "auto" || current.length === 0) {
        return nextIds;
      }
      return mergeStableProjectOrder(current, nextIds);
    });
  }, [folderOrderControlKey, naturalFolderGroups, updateSource, viewMode]);

  const folderGroups = useMemo(() => {
    if (viewMode !== "tree" || folderOrderIds.length === 0) {
      return naturalFolderGroups;
    }
    const groupsById = new Map(naturalFolderGroups.map((group) => [group.id, group] as const));
    return folderOrderIds
      .map((groupId) => groupsById.get(groupId) ?? null)
      .filter((group): group is (typeof naturalFolderGroups)[number] => group !== null);
  }, [folderOrderIds, naturalFolderGroups, viewMode]);

  useEffect(() => {
    if (viewMode !== "tree") {
      return;
    }

    setExpandedFolderIds((current) => {
      const visibleFolderIds = new Set(folderGroups.map((group) => group.id));
      const next = current.filter((groupId) => visibleFolderIds.has(groupId));
      const nextSet = new Set(next);
      let changed = next.length !== current.length;

      for (const group of folderGroups) {
        const isNewFolder = !seenFolderIdsRef.current.has(group.id);
        seenFolderIdsRef.current.add(group.id);
        const shouldForceOpen =
          projectQueryInput.trim().length > 0 ||
          group.projects.some((project) => project.id === selectedProjectId);
        if ((isNewFolder || shouldForceOpen) && !nextSet.has(group.id)) {
          next.push(group.id);
          nextSet.add(group.id);
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [folderGroups, projectQueryInput, selectedProjectId, viewMode]);

  const expandedFolderIdSet = useMemo(() => new Set(expandedFolderIds), [expandedFolderIds]);
  const allVisibleFoldersExpanded =
    folderGroups.length > 0 && folderGroups.every((group) => expandedFolderIdSet.has(group.id));

  const handleToggleFolder = (folderId: string) => {
    setContextMenu(null);
    setExpandedFolderIds((current) =>
      current.includes(folderId)
        ? current.filter((value) => value !== folderId)
        : [...current, folderId],
    );
  };

  const handleToggleAllFolders = () => {
    setContextMenu(null);
    setExpandedFolderIds(allVisibleFoldersExpanded ? [] : folderGroups.map((group) => group.id));
  };

  const getCollapsedFolderUpdateDelta = (projects: ProjectSummary[], expanded: boolean): number => {
    if (expanded) {
      return 0;
    }
    return projects.reduce(
      (total, project) => total + (projectUpdates[project.id]?.messageDelta ?? 0),
      0,
    );
  };

  const renderFlatProjectRow = (project: ProjectSummary) => {
    const update = projectUpdates[project.id];
    return (
      <button
        key={project.id}
        type="button"
        data-project-nav-kind="project"
        data-project-nav-id={project.id}
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
          <span className="project-item-label">{getProjectLabel(project)}</span>
          <span
            className={`project-update-badge${update ? " visible" : ""}`}
            aria-label={update ? `${update.messageDelta} new messages` : undefined}
          >
            {update ? `+${update.messageDelta}` : "+0"}
          </span>
        </div>
        <div className="list-item-path">{compactPath(project.path)}</div>
        <div className="list-item-meta">
          <span className={`meta-tag ${project.provider}`}>{prettyProvider(project.provider)}</span>{" "}
          <span className="sessions-count">
            {project.sessionCount} {project.sessionCount === 1 ? "session" : "sessions"}
          </span>
          <span className="dot-sep" />
          <span>{formatDate(project.lastActivity)}</span>
        </div>
      </button>
    );
  };

  const renderTreeProjectRow = (project: ProjectSummary) => {
    const update = projectUpdates[project.id];
    const isActive = treeFocusedRow?.kind === "project" && treeFocusedRow.id === project.id;
    return (
      <button
        key={project.id}
        type="button"
        data-project-nav-kind="project"
        data-project-nav-id={project.id}
        data-parent-folder-id={getProjectGroupId(project)}
        ref={project.id === selectedProjectId ? selectedProjectRef : null}
        className={`list-item project-item project-tree-item${
          isActive ? " active" : ""
        }${update ? " recently-updated" : ""}`}
        onFocus={() => setTreeFocusedRow({ kind: "project", id: project.id })}
        onClick={() => {
          setContextMenu(null);
          setTreeFocusedRow({ kind: "project", id: project.id });
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
        <div className="project-tree-row-main">
          <div className="project-tree-name-group">
            <span className="project-tree-name">{getProjectLabel(project)}</span>
            <span
              className={`project-update-badge project-tree-update-badge${update ? " visible" : ""}`}
              aria-label={update ? `${update.messageDelta} new messages` : undefined}
            >
              {update ? `+${update.messageDelta}` : "+0"}
            </span>
          </div>
          <div className="project-tree-badge-rail">
            <span className={`meta-tag project-tree-provider-badge ${project.provider}`}>
              {prettyProvider(project.provider)}
              <span className="project-tree-provider-count">{project.sessionCount}</span>
            </span>
          </div>
        </div>
      </button>
    );
  };

  return (
    <aside className={`panel history-focus-pane project-pane${collapsed ? " collapsed" : ""}`}>
      <div className="panel-header">
        <div className="panel-header-left">
          <span className="panel-title">Projects</span>
        </div>
        <div className="pane-head-controls">
          {!collapsed ? (
            <>
              <div className="project-pane-sort-group" ref={sortMenuRef}>
                <button
                  type="button"
                  className="collapse-btn tb-dropdown-trigger project-pane-sort-field-btn"
                  aria-haspopup="menu"
                  aria-expanded={sortMenuOpen}
                  aria-label={`Project sort field: ${sortLabel}`}
                  title={`Sort field: ${sortLabel}. Click to choose a different sort field.`}
                  onClick={() => setSortMenuOpen((value) => !value)}
                >
                  <ProjectPaneSortFieldIcon />
                </button>
                <button
                  type="button"
                  className="collapse-btn sort-btn project-pane-sort-direction-btn"
                  onClick={onToggleSortDirection}
                  aria-label={
                    sortDirection === "asc" ? "Sort projects descending" : "Sort projects ascending"
                  }
                  title={sortTooltip}
                >
                  <ToolbarIcon name={sortDirection === "asc" ? "sortAsc" : "sortDesc"} />
                </button>
                {sortMenuOpen ? (
                  <dialog
                    className="tb-dropdown-menu project-pane-header-menu"
                    open
                    aria-label="Project sort field"
                  >
                    {(
                      Object.entries(PROJECT_SORT_FIELD_LABELS) as [ProjectSortField, string][]
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        className={`tb-dropdown-item tb-dropdown-item-checkable${
                          value === sortField ? " selected" : ""
                        }`}
                        onClick={() => {
                          onSetSortField(value);
                          setSortMenuOpen(false);
                        }}
                      >
                        <span>{label}</span>
                        {value === sortField ? <span className="tb-dropdown-check">✓</span> : null}
                      </button>
                    ))}
                  </dialog>
                ) : null}
              </div>
              <button
                type="button"
                className={`collapse-btn project-pane-view-toggle-btn${
                  viewMode === "tree" ? " active" : ""
                }`}
                onClick={onToggleViewMode}
                aria-label={viewMode === "list" ? "Switch to By Folder" : "Switch to List"}
                title={
                  viewMode === "list"
                    ? "List view enabled. Click to switch to By Folder."
                    : "By Folder view enabled. Click to switch to List."
                }
              >
                {viewMode === "list" ? <ProjectPaneListIcon /> : <ProjectPaneFolderIcon />}
              </button>
              {viewMode === "tree" ? (
                <button
                  type="button"
                  className="collapse-btn"
                  onClick={handleToggleAllFolders}
                  aria-label={
                    allVisibleFoldersExpanded ? "Collapse all folders" : "Expand all folders"
                  }
                  title={
                    allVisibleFoldersExpanded
                      ? "Collapse all visible folders"
                      : "Expand all visible folders"
                  }
                >
                  <ToolbarIcon name={allVisibleFoldersExpanded ? "collapseAll" : "expandAll"} />
                </button>
              ) : null}
              <div className="tb-dropdown project-pane-overflow-dropdown" ref={overflowMenuRef}>
                <button
                  type="button"
                  className="collapse-btn tb-dropdown-trigger"
                  onClick={() => setOverflowMenuOpen((value) => !value)}
                  aria-haspopup="menu"
                  aria-expanded={overflowMenuOpen}
                  aria-label="Project options"
                  title="Project actions"
                >
                  <ProjectPaneMenuIcon />
                </button>
                {overflowMenuOpen ? (
                  <dialog
                    className="tb-dropdown-menu tb-dropdown-menu-right project-pane-header-menu project-pane-overflow-menu"
                    open
                    aria-label="Project options"
                  >
                    <button
                      type="button"
                      className="tb-dropdown-item project-pane-overflow-item"
                      onClick={() => {
                        onCopyProjectDetails();
                        setOverflowMenuOpen(false);
                      }}
                      disabled={!canCopyProjectDetails}
                    >
                      <span className="project-pane-overflow-icon" aria-hidden>
                        <ToolbarIcon name="copy" />
                      </span>
                      <span>Copy</span>
                    </button>
                    <button
                      type="button"
                      className="tb-dropdown-item project-pane-overflow-item"
                      onClick={() => {
                        onOpenProjectLocation();
                        setOverflowMenuOpen(false);
                      }}
                      disabled={!canOpenProjectLocation}
                    >
                      <span className="project-pane-overflow-icon" aria-hidden>
                        <ToolbarIcon name="folderOpen" />
                      </span>
                      <span>Open Folder</span>
                    </button>
                    <div className="tb-dropdown-separator" />
                    <button
                      type="button"
                      className="tb-dropdown-item project-pane-overflow-item project-pane-overflow-item-danger"
                      onClick={() => {
                        onDeleteProject();
                        setOverflowMenuOpen(false);
                      }}
                      disabled={!canDeleteProject}
                    >
                      <span className="project-pane-overflow-icon" aria-hidden>
                        <ToolbarIcon name="trash" />
                      </span>
                      <span>Delete</span>
                    </button>
                  </dialog>
                ) : null}
              </div>
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
      <div
        className={`list-scroll project-list${viewMode === "tree" ? " project-list-tree" : ""}`}
        ref={listRef}
        tabIndex={-1}
      >
        {viewMode === "list"
          ? sortedProjects.map((project) => renderFlatProjectRow(project))
          : folderGroups.map((group) => {
              const isExpanded = expandedFolderIdSet.has(group.id);
              const collapsedUpdateDelta = getCollapsedFolderUpdateDelta(
                group.projects,
                isExpanded,
              );
              const isFolderActive =
                treeFocusedRow?.kind === "folder" && treeFocusedRow.id === group.id;
              return (
                <div key={group.id} className="project-folder-group">
                  <button
                    type="button"
                    data-project-nav-kind="folder"
                    data-folder-id={group.id}
                    data-folder-first-project-id={group.projects[0]?.id ?? ""}
                    data-folder-last-project-id={
                      group.projects[group.projects.length - 1]?.id ?? ""
                    }
                    className={`project-folder-row${isFolderActive ? " active" : ""}${
                      collapsedUpdateDelta > 0 ? " recently-updated" : ""
                    }`}
                    onFocus={() => setTreeFocusedRow({ kind: "folder", id: group.id })}
                    onClick={() => {
                      setTreeFocusedRow({ kind: "folder", id: group.id });
                      handleToggleFolder(group.id);
                    }}
                    aria-expanded={isExpanded}
                    aria-label={`${group.label}, ${group.projectCount} projects`}
                  >
                    <span className="project-folder-chevron" aria-hidden>
                      <ProjectPaneChevron open={isExpanded} />
                    </span>
                    <span className="project-folder-icon" aria-hidden>
                      <ProjectPaneFolderIcon />
                    </span>
                    <span className="project-folder-label">{group.label}</span>
                    {collapsedUpdateDelta > 0 ? (
                      <span
                        className="project-update-badge project-folder-update-badge visible"
                        aria-label={`${collapsedUpdateDelta} new messages`}
                      >
                        +{collapsedUpdateDelta}
                      </span>
                    ) : null}
                    <span className="project-folder-count">{group.projectCount}</span>
                  </button>
                  {isExpanded ? (
                    <div className="project-folder-children">
                      {group.projects.map((project) => renderTreeProjectRow(project))}
                    </div>
                  ) : null}
                </div>
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
