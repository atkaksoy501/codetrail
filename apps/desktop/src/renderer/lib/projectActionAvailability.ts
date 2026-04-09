import type { ProjectSummary, ProjectViewMode } from "../app/types";
import type { ProjectPaneTreeFocusedRow } from "../components/history/ProjectPane.types";

export function canActOnSelectedProject({
  selectedProject,
  projectViewMode,
  treeFocusedRow,
}: {
  selectedProject: ProjectSummary | null | undefined;
  projectViewMode: ProjectViewMode;
  treeFocusedRow: ProjectPaneTreeFocusedRow | null | undefined;
}): boolean {
  return (
    Boolean(selectedProject) && !(projectViewMode === "tree" && treeFocusedRow?.kind === "folder")
  );
}
