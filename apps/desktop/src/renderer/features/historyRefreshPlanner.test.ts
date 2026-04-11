// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import { buildRefreshContext } from "./historyRefreshPlanner";

function defineScrollMetrics(
  element: HTMLElement,
  values: { scrollTop: number; clientHeight: number; scrollHeight: number },
) {
  Object.defineProperty(element, "scrollTop", {
    configurable: true,
    writable: true,
    value: values.scrollTop,
  });
  Object.defineProperty(element, "clientHeight", {
    configurable: true,
    value: values.clientHeight,
  });
  Object.defineProperty(element, "scrollHeight", {
    configurable: true,
    value: values.scrollHeight,
  });
}

describe("buildRefreshContext", () => {
  it("captures explicit scroll-anchor elements before top-level message ids", () => {
    const container = document.createElement("div");
    const message = document.createElement("article");
    message.setAttribute("data-history-message-id", "message_1");
    Object.defineProperty(message, "offsetTop", { configurable: true, value: 40 });

    const combinedFile = document.createElement("div");
    combinedFile.setAttribute("data-history-scroll-anchor-id", "turn-combined:anchor:file.ts");
    Object.defineProperty(combinedFile, "offsetTop", { configurable: true, value: 160 });
    const probe = document.createElement("span");
    combinedFile.appendChild(probe);
    message.appendChild(combinedFile);
    container.appendChild(message);
    document.body.appendChild(container);

    defineScrollMetrics(container, {
      scrollTop: 120,
      clientHeight: 100,
      scrollHeight: 600,
    });
    vi.spyOn(container, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      width: 400,
      height: 300,
      top: 0,
      left: 0,
      right: 400,
      bottom: 300,
      toJSON: () => ({}),
    });
    const originalElementFromPoint = document.elementFromPoint;
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: () => probe as unknown as Element,
    });

    const refreshContext = buildRefreshContext({
      refreshId: 1,
      container,
      selection: {
        historyMode: "session",
        historyDetailMode: "turn",
        effectiveHistoryPage: 0,
        selectedProjectId: "project_1",
        selectedSessionId: "session_1",
        turnSourceSessionId: "session_1",
        turnAnchorMessageId: "anchor_1",
      },
      detailState: {
        detailMessages: [{ id: "message_1" }] as never,
        selectedProject: null,
        selectedSession: null,
        sessionDetail: null,
        projectCombinedDetail: null,
        bookmarksResponse: {
          projectId: "project_1",
          totalCount: 0,
          filteredCount: 0,
          page: 0,
          pageSize: 100,
          categoryCounts: {
            user: 0,
            assistant: 0,
            tool_use: 0,
            tool_edit: 0,
            tool_result: 0,
            thinking: 0,
            system: 0,
          },
          queryError: null,
          highlightPatterns: [],
          results: [],
        },
        sessionTurnDetail: {
          totalCount: 2,
          totalTurns: 3,
        },
      },
      sortState: {
        messagePageSize: 100,
        bookmarkSortDirection: "desc",
        messageSortDirection: "desc",
        projectAllSortDirection: "desc",
        turnViewSortDirection: "desc",
      },
    });

    expect(refreshContext.scrollPreservation).toEqual({
      scrollTop: 120,
      referenceElementId: "turn-combined:anchor:file.ts",
      referenceElementKind: "scroll-anchor",
      referenceOffsetTop: 160,
    });

    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: originalElementFromPoint,
    });
    container.remove();
  });

  it("uses totalTurns to classify live-edge refreshes in turn view", () => {
    const container = document.createElement("div");
    defineScrollMetrics(container, {
      scrollTop: 200,
      clientHeight: 100,
      scrollHeight: 300,
    });

    const refreshContext = buildRefreshContext({
      refreshId: 2,
      container,
      selection: {
        historyMode: "session",
        historyDetailMode: "turn",
        effectiveHistoryPage: 2,
        selectedProjectId: "project_1",
        selectedSessionId: "session_1",
        turnSourceSessionId: "session_1",
        turnAnchorMessageId: "anchor_3",
      },
      detailState: {
        detailMessages: [{ id: "m5" }, { id: "m6" }] as never,
        selectedProject: null,
        selectedSession: null,
        sessionDetail: null,
        projectCombinedDetail: null,
        bookmarksResponse: {
          projectId: "project_1",
          totalCount: 0,
          filteredCount: 0,
          page: 0,
          pageSize: 100,
          categoryCounts: {
            user: 0,
            assistant: 0,
            tool_use: 0,
            tool_edit: 0,
            tool_result: 0,
            thinking: 0,
            system: 0,
          },
          queryError: null,
          highlightPatterns: [],
          results: [],
        },
        sessionTurnDetail: {
          totalCount: 2,
          totalTurns: 3,
        },
      },
      sortState: {
        messagePageSize: 100,
        bookmarkSortDirection: "desc",
        messageSortDirection: "desc",
        projectAllSortDirection: "desc",
        turnViewSortDirection: "asc",
      },
    });

    expect(refreshContext.followEligible).toBe(true);
    expect(refreshContext.baselineTotalCount).toBe(3);
  });

  it("ignores offscreen combined-change anchors and preserves against the visible message anchor", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    defineScrollMetrics(container, {
      scrollTop: 320,
      clientHeight: 180,
      scrollHeight: 1200,
    });
    vi.spyOn(container, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      width: 400,
      height: 300,
      top: 0,
      left: 0,
      right: 400,
      bottom: 300,
      toJSON: () => ({}),
    });

    const combined = document.createElement("article");
    combined.setAttribute("data-history-scroll-anchor-id", "turn-combined:anchor_1");
    Object.defineProperty(combined, "offsetTop", { configurable: true, value: 40 });
    vi.spyOn(combined, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: -220,
      width: 400,
      height: 120,
      top: -220,
      left: 0,
      right: 400,
      bottom: -100,
      toJSON: () => ({}),
    });
    container.appendChild(combined);

    const visibleMessage = document.createElement("article");
    visibleMessage.setAttribute("data-history-message-id", "message_2");
    Object.defineProperty(visibleMessage, "offsetTop", { configurable: true, value: 380 });
    vi.spyOn(visibleMessage, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 24,
      width: 400,
      height: 80,
      top: 24,
      left: 0,
      right: 400,
      bottom: 104,
      toJSON: () => ({}),
    });
    container.appendChild(visibleMessage);

    const originalElementFromPoint = document.elementFromPoint;
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: () => null,
    });

    const refreshContext = buildRefreshContext({
      refreshId: 3,
      container,
      selection: {
        historyMode: "session",
        historyDetailMode: "turn",
        effectiveHistoryPage: 0,
        selectedProjectId: "project_1",
        selectedSessionId: "session_1",
        turnSourceSessionId: "session_1",
        turnAnchorMessageId: "anchor_1",
      },
      detailState: {
        detailMessages: [{ id: "message_2" }] as never,
        selectedProject: null,
        selectedSession: null,
        sessionDetail: null,
        projectCombinedDetail: null,
        bookmarksResponse: {
          projectId: "project_1",
          totalCount: 0,
          filteredCount: 0,
          page: 0,
          pageSize: 100,
          categoryCounts: {
            user: 0,
            assistant: 0,
            tool_use: 0,
            tool_edit: 0,
            tool_result: 0,
            thinking: 0,
            system: 0,
          },
          queryError: null,
          highlightPatterns: [],
          results: [],
        },
        sessionTurnDetail: {
          totalCount: 1,
          totalTurns: 3,
        },
      },
      sortState: {
        messagePageSize: 100,
        bookmarkSortDirection: "desc",
        messageSortDirection: "desc",
        projectAllSortDirection: "desc",
        turnViewSortDirection: "desc",
      },
    });

    expect(refreshContext.scrollPreservation).toEqual({
      scrollTop: 320,
      referenceElementId: "message_2",
      referenceElementKind: "message",
      referenceOffsetTop: 380,
    });

    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: originalElementFromPoint,
    });
    container.remove();
  });

  it("falls back to raw scroll preservation when no visible anchor exists", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    defineScrollMetrics(container, {
      scrollTop: 260,
      clientHeight: 180,
      scrollHeight: 1200,
    });
    vi.spyOn(container, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      width: 400,
      height: 300,
      top: 0,
      left: 0,
      right: 400,
      bottom: 300,
      toJSON: () => ({}),
    });

    const hiddenAnchor = document.createElement("article");
    hiddenAnchor.setAttribute("data-history-scroll-anchor-id", "turn-combined:anchor_1");
    Object.defineProperty(hiddenAnchor, "offsetTop", { configurable: true, value: 40 });
    vi.spyOn(hiddenAnchor, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: -220,
      width: 400,
      height: 120,
      top: -220,
      left: 0,
      right: 400,
      bottom: -100,
      toJSON: () => ({}),
    });
    container.appendChild(hiddenAnchor);

    const originalElementFromPoint = document.elementFromPoint;
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: () => null,
    });

    const refreshContext = buildRefreshContext({
      refreshId: 4,
      container,
      selection: {
        historyMode: "session",
        historyDetailMode: "turn",
        effectiveHistoryPage: 0,
        selectedProjectId: "project_1",
        selectedSessionId: "session_1",
        turnSourceSessionId: "session_1",
        turnAnchorMessageId: "anchor_1",
      },
      detailState: {
        detailMessages: [] as never,
        selectedProject: null,
        selectedSession: null,
        sessionDetail: null,
        projectCombinedDetail: null,
        bookmarksResponse: {
          projectId: "project_1",
          totalCount: 0,
          filteredCount: 0,
          page: 0,
          pageSize: 100,
          categoryCounts: {
            user: 0,
            assistant: 0,
            tool_use: 0,
            tool_edit: 0,
            tool_result: 0,
            thinking: 0,
            system: 0,
          },
          queryError: null,
          highlightPatterns: [],
          results: [],
        },
        sessionTurnDetail: {
          totalCount: 0,
          totalTurns: 3,
        },
      },
      sortState: {
        messagePageSize: 100,
        bookmarkSortDirection: "desc",
        messageSortDirection: "desc",
        projectAllSortDirection: "desc",
        turnViewSortDirection: "desc",
      },
    });

    expect(refreshContext.scrollPreservation).toEqual({
      scrollTop: 260,
      referenceElementId: "",
      referenceElementKind: "message",
      referenceOffsetTop: 0,
    });

    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: originalElementFromPoint,
    });
    container.remove();
  });
});
