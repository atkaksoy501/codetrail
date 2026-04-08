import { createHistorySelection } from "../app/historySelection";
import type { HistoryDetailMode, HistorySelection, HistoryVisualization } from "../app/types";

export function deriveHistoryVisualization(
  historyMode: HistorySelection["mode"],
  historyDetailMode: HistoryDetailMode,
): HistoryVisualization {
  if (historyDetailMode === "turn") {
    return "turns";
  }
  if (historyMode === "bookmarks") {
    return "bookmarks";
  }
  return "messages";
}

export function getHistoryDetailModeForVisualization(
  historyVisualization: HistoryVisualization,
): HistoryDetailMode {
  return historyVisualization === "turns" ? "turn" : "flat";
}

export function getTurnVisualizationSelection(args: {
  selection: HistorySelection;
  selectedProjectId: string;
}): HistorySelection {
  if (args.selection.mode !== "bookmarks") {
    return args.selection;
  }
  if (args.selection.sessionId) {
    return createHistorySelection("session", args.selection.projectId, args.selection.sessionId);
  }
  return createHistorySelection("project_all", args.selectedProjectId, "");
}
