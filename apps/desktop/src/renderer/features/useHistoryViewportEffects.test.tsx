// @vitest-environment jsdom

import { act, render, screen, waitFor } from "@testing-library/react";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { HistoryMessage, PendingMessagePageNavigation } from "../app/types";
import { useHistoryViewportEffects } from "./useHistoryViewportEffects";

function ViewportHarness({
  historyDetailMode,
  historyMode,
  selectedProjectId = "",
  selectedSessionId = "session_1",
  turnAnchorMessageId = "",
  sessionPage,
}: {
  historyDetailMode: "flat" | "turn";
  historyMode: "session" | "bookmarks" | "project_all";
  selectedProjectId?: string;
  selectedSessionId?: string;
  turnAnchorMessageId?: string;
  sessionPage: number;
}) {
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const focusedMessageRef = useRef<HTMLDivElement | null>(null);
  const sessionScrollTopRef = useRef(0);
  const pendingRestoredSessionScrollRef = useRef<{
    sessionId: string;
    sessionPage: number;
    scrollTop: number;
  } | null>(null);
  const refreshContextRef = useRef(null);
  const pendingAutoScrollRef = useRef(false);
  const prevMessageIdsRef = useRef("");
  const [pendingMessageAreaFocus, setPendingMessageAreaFocus] = useState(false);
  const [pendingMessagePageNavigation, setPendingMessagePageNavigation] =
    useState<PendingMessagePageNavigation | null>(null);
  const [, setSessionScrollTop] = useState(0);
  const [, setFocusMessageId] = useState("");
  const scrollPreservationRef = useRef<{
    scrollTop: number;
    referenceElementId: string;
    referenceElementKind: "message" | "scroll-anchor";
    referenceOffsetTop: number;
  } | null>(null);

  useHistoryViewportEffects({
    messageListRef,
    historyDetailMode,
    historyMode,
    selectedProjectId,
    selectedSessionId,
    turnAnchorMessageId,
    sessionPage,
    setSessionScrollTop,
    sessionScrollTopRef,
    pendingRestoredSessionScrollRef,
    refreshContextRef,
    pendingAutoScrollRef,
    prevMessageIdsRef,
    activeHistoryMessages: [{ id: "message_1" }] as HistoryMessage[],
    activeMessageSortDirection: "desc",
    focusMessageId: "",
    visibleFocusedMessageId: "",
    focusedMessagePosition: -1,
    focusedMessageRef,
    pendingMessageAreaFocus,
    setPendingMessageAreaFocus,
    pendingMessagePageNavigation,
    loadedHistoryPage: sessionPage,
    setPendingMessagePageNavigation,
    setFocusMessageId,
    scrollPreservationRef,
  });

  return <div ref={messageListRef} data-testid="message-list" />;
}

function ViewportRestoreHarness({
  scrollPreservation,
}: {
  scrollPreservation: {
    scrollTop: number;
    referenceElementId: string;
    referenceElementKind: "message" | "scroll-anchor";
    referenceOffsetTop: number;
  } | null;
}) {
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const focusedMessageRef = useRef<HTMLDivElement | null>(null);
  const sessionScrollTopRef = useRef(0);
  const pendingRestoredSessionScrollRef = useRef<{
    sessionId: string;
    sessionPage: number;
    scrollTop: number;
  } | null>(null);
  const refreshContextRef = useRef(null);
  const pendingAutoScrollRef = useRef(false);
  const prevMessageIdsRef = useRef("");
  const [pendingMessageAreaFocus, setPendingMessageAreaFocus] = useState(false);
  const [pendingMessagePageNavigation, setPendingMessagePageNavigation] =
    useState<PendingMessagePageNavigation | null>(null);
  const [, setSessionScrollTop] = useState(0);
  const [, setFocusMessageId] = useState("");
  const scrollPreservationRef = useRef<{
    scrollTop: number;
    referenceElementId: string;
    referenceElementKind: "message" | "scroll-anchor";
    referenceOffsetTop: number;
  } | null>(scrollPreservation);
  scrollPreservationRef.current = scrollPreservation;

  useHistoryViewportEffects({
    messageListRef,
    historyDetailMode: "turn",
    historyMode: "session",
    selectedProjectId: "project_1",
    selectedSessionId: "session_1",
    turnAnchorMessageId: "turn_anchor_1",
    sessionPage: 0,
    setSessionScrollTop,
    sessionScrollTopRef,
    pendingRestoredSessionScrollRef,
    refreshContextRef,
    pendingAutoScrollRef,
    prevMessageIdsRef,
    activeHistoryMessages: [{ id: "message_1" }] as HistoryMessage[],
    activeMessageSortDirection: "desc",
    focusMessageId: "",
    visibleFocusedMessageId: "",
    focusedMessagePosition: -1,
    focusedMessageRef,
    pendingMessageAreaFocus,
    setPendingMessageAreaFocus,
    pendingMessagePageNavigation,
    loadedHistoryPage: 0,
    setPendingMessagePageNavigation,
    setFocusMessageId,
    scrollPreservationRef,
  });

  return (
    <div
      ref={(node) => {
        messageListRef.current = node;
        if (!node) {
          return;
        }
        Object.defineProperty(node, "scrollTop", {
          configurable: true,
          writable: true,
          value: 0,
        });
      }}
      data-testid="message-list"
    >
      <div
        ref={(node) => {
          if (!node) {
            return;
          }
          Object.defineProperty(node, "offsetTop", { configurable: true, value: 140 });
        }}
        data-history-scroll-anchor-id="turn-combined:anchor:file.ts"
        data-testid="scroll-anchor"
      >
        anchor
      </div>
    </div>
  );
}

describe("useHistoryViewportEffects", () => {
  it("resets scroll when a flat history page changes", async () => {
    const { rerender } = render(
      <ViewportHarness historyDetailMode="flat" historyMode="session" sessionPage={0} />,
    );
    const container = screen.getByTestId("message-list");

    await waitFor(() => {
      expect(container.scrollTop).toBe(0);
    });

    act(() => {
      container.scrollTop = 180;
    });

    rerender(<ViewportHarness historyDetailMode="flat" historyMode="session" sessionPage={1} />);

    await waitFor(() => {
      expect(container.scrollTop).toBe(0);
    });
  });

  it("preserves scroll when turn display page changes but the viewed turn anchor stays the same", async () => {
    const { rerender } = render(
      <ViewportHarness
        historyDetailMode="turn"
        historyMode="session"
        turnAnchorMessageId="turn_anchor_1"
        sessionPage={0}
      />,
    );
    const container = screen.getByTestId("message-list");

    await waitFor(() => {
      expect(container.scrollTop).toBe(0);
    });

    act(() => {
      container.scrollTop = 180;
    });

    rerender(
      <ViewportHarness
        historyDetailMode="turn"
        historyMode="session"
        turnAnchorMessageId="turn_anchor_1"
        sessionPage={1}
      />,
    );

    await waitFor(() => {
      expect(container.scrollTop).toBe(180);
    });
  });

  it("resets scroll when the viewed turn anchor changes", async () => {
    const { rerender } = render(
      <ViewportHarness
        historyDetailMode="turn"
        historyMode="session"
        turnAnchorMessageId="turn_anchor_1"
        sessionPage={0}
      />,
    );
    const container = screen.getByTestId("message-list");

    await waitFor(() => {
      expect(container.scrollTop).toBe(0);
    });

    act(() => {
      container.scrollTop = 180;
    });

    rerender(
      <ViewportHarness
        historyDetailMode="turn"
        historyMode="session"
        turnAnchorMessageId="turn_anchor_2"
        sessionPage={0}
      />,
    );

    await waitFor(() => {
      expect(container.scrollTop).toBe(0);
    });
  });

  it("restores scroll against explicit scroll-anchor ids", async () => {
    const { rerender } = render(<ViewportRestoreHarness scrollPreservation={null} />);
    const container = screen.getByTestId("message-list");

    await waitFor(() => {
      expect(container.scrollTop).toBe(0);
    });

    rerender(
      <ViewportRestoreHarness
        scrollPreservation={{
          scrollTop: 120,
          referenceElementId: "turn-combined:anchor:file.ts",
          referenceElementKind: "scroll-anchor",
          referenceOffsetTop: 80,
        }}
      />,
    );

    await waitFor(() => {
      expect(container.scrollTop).toBe(180);
    });
  });

  it("falls back to restoring raw scrollTop when no anchor id is available", async () => {
    const { rerender } = render(<ViewportRestoreHarness scrollPreservation={null} />);
    const container = screen.getByTestId("message-list");

    await waitFor(() => {
      expect(container.scrollTop).toBe(0);
    });

    rerender(
      <ViewportRestoreHarness
        scrollPreservation={{
          scrollTop: 210,
          referenceElementId: "",
          referenceElementKind: "message",
          referenceOffsetTop: 0,
        }}
      />,
    );

    await waitFor(() => {
      expect(container.scrollTop).toBe(210);
    });
  });
});
