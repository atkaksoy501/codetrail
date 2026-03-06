type SessionLike = {
  id: string;
};

export type SessionSelectionDecision = {
  nextSelectedSessionId: string;
  resetPage: boolean;
};

// Selection repair runs after session data loads so the UI can preserve an existing choice when it
// is still valid, but fall back to the first session when filters/project changes invalidate it.
export function decideSessionSelectionAfterLoad(args: {
  paneStateHydrated: boolean;
  sessionsLoadedProjectId: string | null;
  selectedProjectId: string;
  hasPendingSearchNavigation: boolean;
  selectedSessionId: string;
  sortedSessions: SessionLike[];
}): SessionSelectionDecision | null {
  const {
    paneStateHydrated,
    sessionsLoadedProjectId,
    selectedProjectId,
    hasPendingSearchNavigation,
    selectedSessionId,
    sortedSessions,
  } = args;

  if (!paneStateHydrated) {
    return null;
  }

  if (sessionsLoadedProjectId !== selectedProjectId) {
    return null;
  }

  if (sortedSessions.length === 0) {
    if (hasPendingSearchNavigation || selectedSessionId === "") {
      return null;
    }
    return { nextSelectedSessionId: "", resetPage: false };
  }

  if (hasPendingSearchNavigation) {
    return null;
  }

  if (selectedSessionId && sortedSessions.some((session) => session.id === selectedSessionId)) {
    return null;
  }

  const nextSelectedSessionId = sortedSessions[0]?.id ?? "";
  if (nextSelectedSessionId === selectedSessionId) {
    return null;
  }

  return { nextSelectedSessionId, resetPage: true };
}
