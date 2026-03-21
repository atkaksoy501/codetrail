// @vitest-environment jsdom

import type { ComponentProps } from "react";

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SEARCH_PLACEHOLDERS } from "../../lib/searchPlaceholders";
import { ProjectPane } from "./ProjectPane";

const projects = [
  {
    id: "project_1",
    provider: "claude" as const,
    name: "Project One",
    path: "/Users/test/project-one",
    sessionCount: 2,
    messageCount: 12,
    lastActivity: "2026-03-01T12:00:00.000Z",
  },
  {
    id: "project_2",
    provider: "codex" as const,
    name: "Project Two",
    path: "/Users/test/project-two",
    sessionCount: 1,
    messageCount: 6,
    lastActivity: "2026-03-01T13:00:00.000Z",
  },
  {
    id: "project_3",
    provider: "gemini" as const,
    name: "Project Three",
    path: "/tmp/project-three",
    sessionCount: 7,
    messageCount: 22,
    lastActivity: "2026-03-01T10:00:00.000Z",
  },
];

function renderProjectPane(overrides: Partial<ComponentProps<typeof ProjectPane>> = {}) {
  return render(
    <ProjectPane
      sortedProjects={projects}
      selectedProjectId="project_1"
      sortField="last_active"
      sortDirection="desc"
      viewMode="list"
      updateSource="resort"
      collapsed={false}
      projectQueryInput=""
      projectProviders={["claude", "codex", "gemini"]}
      providers={["claude", "codex", "gemini", "cursor"]}
      projectProviderCounts={{ claude: 1, codex: 1, gemini: 1, cursor: 0, copilot: 0 }}
      projectUpdates={{ project_2: { messageDelta: 3, updatedAt: Date.now() } }}
      onToggleCollapsed={vi.fn()}
      onProjectQueryChange={vi.fn()}
      onToggleProvider={vi.fn()}
      onSetSortField={vi.fn()}
      onToggleSortDirection={vi.fn()}
      onToggleViewMode={vi.fn()}
      onCopyProjectDetails={vi.fn()}
      onSelectProject={vi.fn()}
      onOpenProjectLocation={vi.fn()}
      onDeleteProject={vi.fn()}
      canCopyProjectDetails={true}
      canDeleteProject={true}
      canOpenProjectLocation={true}
      {...overrides}
    />,
  );
}

describe("ProjectPane", () => {
  it("renders projects and dispatches list interactions through the new toolbar", async () => {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      value: () => undefined,
      configurable: true,
    });

    const user = userEvent.setup();
    const onToggleCollapsed = vi.fn();
    const onSetSortField = vi.fn();
    const onToggleSortDirection = vi.fn();
    const onToggleViewMode = vi.fn();
    const onProjectQueryChange = vi.fn();
    const onToggleProvider = vi.fn();
    const onSelectProject = vi.fn();
    const onCopyProjectDetails = vi.fn();
    const onOpenProjectLocation = vi.fn();

    renderProjectPane({
      onToggleCollapsed,
      onSetSortField,
      onToggleSortDirection,
      onToggleViewMode,
      onProjectQueryChange,
      onToggleProvider,
      onSelectProject,
      onCopyProjectDetails,
      onOpenProjectLocation,
    });

    expect(screen.getByText("Project One")).toBeInTheDocument();
    expect(screen.getByText("Project Two")).toBeInTheDocument();
    expect(screen.getByText("+3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Collapse Projects pane" })).toHaveAttribute(
      "title",
      "Collapse Projects (Cmd/Ctrl+B)",
    );

    await user.click(screen.getByRole("button", { name: "Collapse Projects pane" }));
    await user.click(screen.getByRole("button", { name: "Project sort field: Last Active" }));
    await user.click(screen.getByRole("button", { name: "Name" }));
    await user.click(screen.getByRole("button", { name: "Sort projects ascending" }));
    await user.click(screen.getByRole("button", { name: "Project options" }));
    await user.click(screen.getByRole("button", { name: "Copy" }));
    await user.click(screen.getByRole("button", { name: "Switch to By Folder" }));
    await user.type(screen.getByPlaceholderText(SEARCH_PLACEHOLDERS.sidebarProjects), "abc");
    await user.click(screen.getAllByRole("button", { name: /Gemini/i })[0]!);
    await user.click(screen.getByRole("button", { name: /Project Two/i }));

    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
    expect(onSetSortField).toHaveBeenCalledWith("name");
    expect(onToggleSortDirection).toHaveBeenCalledTimes(1);
    expect(onToggleViewMode).toHaveBeenCalledTimes(1);
    expect(onProjectQueryChange).toHaveBeenCalled();
    expect(onToggleProvider).toHaveBeenCalledWith("gemini");
    expect(onSelectProject).toHaveBeenCalledWith("project_2");
    expect(onCopyProjectDetails).toHaveBeenCalledTimes(1);
    expect(onOpenProjectLocation).not.toHaveBeenCalled();
  });

  it("hides sort and overflow actions when collapsed", () => {
    renderProjectPane({
      collapsed: true,
      selectedProjectId: "",
      sortDirection: "asc",
      projectProviders: ["claude"],
      canCopyProjectDetails: false,
      canDeleteProject: false,
      canOpenProjectLocation: false,
    });

    expect(screen.getByRole("button", { name: "Expand Projects pane" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand Projects pane" })).toHaveAttribute(
      "title",
      "Expand Projects (Cmd/Ctrl+B)",
    );
    expect(screen.queryByRole("button", { name: "Project sort field: Last Active" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sort projects descending" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Switch to By Folder" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Project options" })).toBeNull();
  });

  it("shows a single expand-or-collapse-all control only in tree view", async () => {
    const user = userEvent.setup();

    const { rerender } = renderProjectPane({
      viewMode: "tree",
    });

    expect(screen.getByRole("button", { name: "Collapse all folders" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Collapse all folders" }));

    expect(screen.getByRole("button", { name: "Expand all folders" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Project One/i })).toBeNull();

    rerender(
      <ProjectPane
        sortedProjects={projects}
        selectedProjectId="project_1"
        sortField="last_active"
        sortDirection="desc"
        viewMode="list"
        updateSource="resort"
        collapsed={false}
        projectQueryInput=""
        projectProviders={["claude", "codex", "gemini"]}
        providers={["claude", "codex", "gemini", "cursor"]}
        projectProviderCounts={{ claude: 1, codex: 1, gemini: 1, cursor: 0, copilot: 0 }}
        projectUpdates={{ project_2: { messageDelta: 3, updatedAt: Date.now() } }}
        onToggleCollapsed={vi.fn()}
        onProjectQueryChange={vi.fn()}
        onToggleProvider={vi.fn()}
        onSetSortField={vi.fn()}
        onToggleSortDirection={vi.fn()}
        onToggleViewMode={vi.fn()}
        onCopyProjectDetails={vi.fn()}
        onSelectProject={vi.fn()}
        onOpenProjectLocation={vi.fn()}
        onDeleteProject={vi.fn()}
        canCopyProjectDetails={true}
        canDeleteProject={true}
        canOpenProjectLocation={true}
      />,
    );

    expect(screen.queryByRole("button", { name: "Expand all folders" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Collapse all folders" })).toBeNull();
  });

  it("resets seen folders when switching away from tree view and back", async () => {
    const user = userEvent.setup();

    const { rerender } = renderProjectPane({
      viewMode: "tree",
    });

    await user.click(screen.getByRole("button", { name: /~\/project-one, 1 projects/i }));
    expect(screen.queryByRole("button", { name: /Project One/i })).toBeNull();

    rerender(
      <ProjectPane
        sortedProjects={projects}
        selectedProjectId="project_1"
        sortField="last_active"
        sortDirection="desc"
        viewMode="list"
        updateSource="resort"
        collapsed={false}
        projectQueryInput=""
        projectProviders={["claude", "codex", "gemini"]}
        providers={["claude", "codex", "gemini", "cursor"]}
        projectProviderCounts={{ claude: 1, codex: 1, gemini: 1, cursor: 0, copilot: 0 }}
        projectUpdates={{}}
        onToggleCollapsed={vi.fn()}
        onProjectQueryChange={vi.fn()}
        onToggleProvider={vi.fn()}
        onSetSortField={vi.fn()}
        onToggleSortDirection={vi.fn()}
        onToggleViewMode={vi.fn()}
        onCopyProjectDetails={vi.fn()}
        onSelectProject={vi.fn()}
        onOpenProjectLocation={vi.fn()}
        onDeleteProject={vi.fn()}
        canCopyProjectDetails={true}
        canDeleteProject={true}
        canOpenProjectLocation={true}
      />,
    );

    rerender(
      <ProjectPane
        sortedProjects={projects}
        selectedProjectId="project_1"
        sortField="last_active"
        sortDirection="desc"
        viewMode="tree"
        updateSource="resort"
        collapsed={false}
        projectQueryInput=""
        projectProviders={["claude", "codex", "gemini"]}
        providers={["claude", "codex", "gemini", "cursor"]}
        projectProviderCounts={{ claude: 1, codex: 1, gemini: 1, cursor: 0, copilot: 0 }}
        projectUpdates={{}}
        onToggleCollapsed={vi.fn()}
        onProjectQueryChange={vi.fn()}
        onToggleProvider={vi.fn()}
        onSetSortField={vi.fn()}
        onToggleSortDirection={vi.fn()}
        onToggleViewMode={vi.fn()}
        onCopyProjectDetails={vi.fn()}
        onSelectProject={vi.fn()}
        onOpenProjectLocation={vi.fn()}
        onDeleteProject={vi.fn()}
        canCopyProjectDetails={true}
        canDeleteProject={true}
        canOpenProjectLocation={true}
      />,
    );

    expect(screen.getByRole("button", { name: /Project One/i })).toBeInTheDocument();
  });

  it("opens a project context menu with grouped actions for the clicked row", async () => {
    const user = userEvent.setup();
    const onSelectProject = vi.fn();
    const onOpenProjectLocation = vi.fn();

    renderProjectPane({
      onSelectProject,
      onOpenProjectLocation,
    });

    fireEvent.contextMenu(screen.getByRole("button", { name: /Project Two/i }));

    expect(screen.getByRole("menuitem", { name: "Copy" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Open Folder" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "Open Folder" }));

    expect(onSelectProject).toHaveBeenCalledWith("project_2");
    expect(onOpenProjectLocation).toHaveBeenCalledWith("project_2");
    expect(screen.queryByRole("menuitem", { name: "Delete" })).toBeNull();
  });

  it("renders compact folder groups in tree mode and only toggles folders on root click", async () => {
    const user = userEvent.setup();
    const onSelectProject = vi.fn();

    renderProjectPane({
      viewMode: "tree",
      onSelectProject,
    });

    expect(screen.getByRole("button", { name: "~/project-one, 1 projects" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "~/project-two, 1 projects" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "/tmp/project-three, 1 projects" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Today 1:00 PM")).toBeNull();

    await user.click(screen.getByRole("button", { name: "~/project-one, 1 projects" }));

    expect(onSelectProject).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Project One/i })).toBeNull();

    await user.click(screen.getByRole("button", { name: "~/project-one, 1 projects" }));
    await user.click(screen.getByRole("button", { name: /Project One/i }));

    expect(onSelectProject).toHaveBeenCalledWith("project_1");
  });

  it("hides empty roots in tree mode when the visible project set is filtered", () => {
    renderProjectPane({
      viewMode: "tree",
      sortedProjects: [projects[2]!],
      projectQueryInput: "three",
    });

    expect(
      screen.getByRole("button", { name: "/tmp/project-three, 1 projects" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "~/project-one, 1 projects" })).toBeNull();
  });

  it("keeps folder ordering stable during auto refresh while showing child update badges", () => {
    const { rerender } = renderProjectPane({
      viewMode: "tree",
      updateSource: "resort",
      sortedProjects: [projects[1]!, projects[0]!, projects[2]!],
    });

    const projectTwoFolder = screen.getByRole("button", { name: "~/project-two, 1 projects" });
    const projectThreeFolder = screen.getByRole("button", {
      name: "/tmp/project-three, 1 projects",
    });
    expect(
      projectTwoFolder.compareDocumentPosition(projectThreeFolder) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    rerender(
      <ProjectPane
        sortedProjects={[projects[2]!, projects[0]!, projects[1]!]}
        selectedProjectId="project_1"
        sortField="last_active"
        sortDirection="desc"
        viewMode="tree"
        updateSource="auto"
        collapsed={false}
        projectQueryInput=""
        projectProviders={["claude", "codex", "gemini"]}
        providers={["claude", "codex", "gemini", "cursor"]}
        projectProviderCounts={{ claude: 1, codex: 1, gemini: 1, cursor: 0, copilot: 0 }}
        projectUpdates={{ project_3: { messageDelta: 4, updatedAt: Date.now() } }}
        onToggleCollapsed={vi.fn()}
        onProjectQueryChange={vi.fn()}
        onToggleProvider={vi.fn()}
        onSetSortField={vi.fn()}
        onToggleSortDirection={vi.fn()}
        onToggleViewMode={vi.fn()}
        onCopyProjectDetails={vi.fn()}
        onSelectProject={vi.fn()}
        onOpenProjectLocation={vi.fn()}
        onDeleteProject={vi.fn()}
        canCopyProjectDetails={true}
        canDeleteProject={true}
        canOpenProjectLocation={true}
      />,
    );

    const reorderedProjectTwoFolder = screen.getByRole("button", {
      name: "~/project-two, 1 projects",
    });
    const reorderedProjectThreeFolder = screen.getByRole("button", {
      name: "/tmp/project-three, 1 projects",
    });
    expect(
      reorderedProjectTwoFolder.compareDocumentPosition(reorderedProjectThreeFolder) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getByText("+4")).toBeInTheDocument();
  });

  it("shows root-level update indicators only when a folder is collapsed", async () => {
    const user = userEvent.setup();
    const { rerender } = renderProjectPane({
      viewMode: "tree",
      sortedProjects: [projects[0]!, projects[1]!],
      projectUpdates: {},
    });

    await user.click(screen.getByRole("button", { name: "~/project-one, 1 projects" }));

    rerender(
      <ProjectPane
        sortedProjects={[projects[0]!, projects[1]!]}
        selectedProjectId=""
        sortField="last_active"
        sortDirection="desc"
        viewMode="tree"
        updateSource="auto"
        collapsed={false}
        projectQueryInput=""
        projectProviders={["claude", "codex", "gemini"]}
        providers={["claude", "codex", "gemini", "cursor"]}
        projectProviderCounts={{ claude: 1, codex: 1, gemini: 0, cursor: 0, copilot: 0 }}
        projectUpdates={{ project_1: { messageDelta: 5, updatedAt: Date.now() } }}
        onToggleCollapsed={vi.fn()}
        onProjectQueryChange={vi.fn()}
        onToggleProvider={vi.fn()}
        onSetSortField={vi.fn()}
        onToggleSortDirection={vi.fn()}
        onToggleViewMode={vi.fn()}
        onCopyProjectDetails={vi.fn()}
        onSelectProject={vi.fn()}
        onOpenProjectLocation={vi.fn()}
        onDeleteProject={vi.fn()}
        canCopyProjectDetails={true}
        canDeleteProject={true}
        canOpenProjectLocation={true}
      />,
    );

    const collapsedRoot = screen.getByRole("button", { name: "~/project-one, 1 projects" });
    expect(collapsedRoot).toHaveTextContent("+5");
    expect(screen.queryByRole("button", { name: /Project One/i })).toBeNull();

    await user.click(collapsedRoot);

    expect(collapsedRoot).not.toHaveTextContent("+5");
    expect(screen.getByText("Project One")).toBeInTheDocument();
    expect(screen.getByLabelText("5 new messages")).toBeInTheDocument();
  });
});
