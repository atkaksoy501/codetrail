import type { ProjectSummary, SessionSummary } from "../app/types";
import { deriveSessionTitle, prettyProvider } from "../lib/viewUtils";
import { formatDuration } from "./historyControllerShared";

export function formatProjectDetails(
  project: ProjectSummary,
  overrides: {
    messageCount?: number;
  } = {},
): string {
  const messageCount = overrides.messageCount ?? project.messageCount;
  return [
    `Name: ${project.name || "(untitled project)"}`,
    `Provider: ${prettyProvider(project.provider)}`,
    `Project ID: ${project.id}`,
    `Path: ${project.path || "-"}`,
    `Sessions: ${project.sessionCount}`,
    `Messages: ${messageCount}`,
    `Last Activity: ${project.lastActivity ?? "-"}`,
  ].join("\n");
}

export function formatSessionDetails(
  session: SessionSummary,
  options: {
    projectLabel?: string | null;
    messageCount?: number;
    page?: {
      current: number;
      total: number;
    } | null;
  } = {},
): string {
  const messageCount = options.messageCount ?? session.messageCount;
  const lines = [
    `Title: ${deriveSessionTitle(session)}`,
    `Provider: ${prettyProvider(session.provider)}`,
    `Project: ${options.projectLabel || "(unknown project)"}`,
    `Session ID: ${session.id}`,
    `File: ${session.filePath}`,
    `CWD: ${session.cwd ?? "-"}`,
    `Branch: ${session.gitBranch ?? "-"}`,
    `Models: ${session.modelNames || "-"}`,
    `Started: ${session.startedAt ?? "-"}`,
    `Ended: ${session.endedAt ?? "-"}`,
    `Duration: ${formatDuration(session.durationMs)}`,
    `Messages: ${messageCount}`,
  ];

  if (options.page) {
    lines.push(`Page: ${options.page.current}/${options.page.total}`);
  }

  return lines.join("\n");
}
