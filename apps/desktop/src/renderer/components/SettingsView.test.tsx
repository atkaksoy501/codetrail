// @vitest-environment jsdom

import type { IpcResponse, MessageCategory, Provider } from "@codetrail/core/browser";
import { createSettingsInfoFixture } from "@codetrail/core/testing";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const { copyTextToClipboard, openPath } = vi.hoisted(() => ({
  copyTextToClipboard: vi.fn(async () => true),
  openPath: vi.fn(async () => ({ ok: true, error: null })),
}));

vi.mock("../lib/clipboard", () => ({
  copyTextToClipboard,
}));

vi.mock("../lib/pathActions", () => ({
  openPath,
}));

import { SettingsView } from "./SettingsView";

const info = createSettingsInfoFixture() satisfies IpcResponse<"app:getSettingsInfo">;

const diagnostics = {
  startedAt: "2026-03-16T10:00:00.000Z",
  watcher: {
    backend: "kqueue" as const,
    watchedRootCount: 5,
    watchBasedTriggers: 4,
    fallbackToIncrementalScans: 1,
    lastTriggerAt: "2026-03-16T10:05:00.000Z",
    lastTriggerPathCount: 2,
  },
  jobs: {
    startupIncremental: makeDiagnosticsBucket(),
    manualIncremental: makeDiagnosticsBucket({
      runs: 2,
      averageDurationMs: 150,
      maxDurationMs: 220,
    }),
    manualForceReindex: makeDiagnosticsBucket(),
    watchTriggered: makeDiagnosticsBucket({
      runs: 3,
      averageDurationMs: 80,
      maxDurationMs: 120,
    }),
    watchTargeted: makeDiagnosticsBucket({
      runs: 2,
      averageDurationMs: 50,
      maxDurationMs: 65,
    }),
    watchFallbackIncremental: makeDiagnosticsBucket({
      runs: 1,
      averageDurationMs: 120,
      maxDurationMs: 120,
    }),
    watchInitialScan: makeDiagnosticsBucket(),
    totals: {
      completedRuns: 5,
      failedRuns: 0,
    },
  },
  lastRun: {
    source: "watch_fallback_incremental" as const,
    completedAt: "2026-03-16T10:05:03.000Z",
    durationMs: 320,
    success: true,
  },
};

function createBaseProps() {
  return {
    diagnostics,
    diagnosticsLoading: false,
    diagnosticsError: null,
    appearance: {
      theme: "dark" as const,
      zoomPercent: 100,
      monoFontFamily: "droid_sans_mono" as const,
      regularFontFamily: "current" as const,
      monoFontSize: "12px" as const,
      regularFontSize: "13.5px" as const,
      useMonospaceForAllMessages: false,
      onThemeChange: vi.fn(),
      onZoomPercentChange: vi.fn(),
      onMonoFontFamilyChange: vi.fn(),
      onRegularFontFamilyChange: vi.fn(),
      onMonoFontSizeChange: vi.fn(),
      onRegularFontSizeChange: vi.fn(),
      onUseMonospaceForAllMessagesChange: vi.fn(),
    },
    indexing: {
      enabledProviders: ["claude", "codex", "gemini", "cursor", "copilot"] as Provider[],
      removeMissingSessionsDuringIncrementalIndexing: false,
      canForceReindex: true,
      onToggleProviderEnabled: vi.fn(),
      onForceReindex: vi.fn(),
      onRemoveMissingSessionsDuringIncrementalIndexingChange: vi.fn(),
    },
    messageRules: {
      expandedByDefaultCategories: ["assistant"] as MessageCategory[],
      onToggleExpandedByDefault: vi.fn(),
      systemMessageRegexRules: {
        claude: ["^<command-name>"],
        codex: ["^<environment_context>"],
        gemini: [],
        cursor: [],
        copilot: [],
      },
      onAddSystemMessageRegexRule: vi.fn(),
      onUpdateSystemMessageRegexRule: vi.fn(),
      onRemoveSystemMessageRegexRule: vi.fn(),
    },
    onActionError: vi.fn(),
  };
}

describe("SettingsView", () => {
  it("renders loading and error states", () => {
    const baseProps = createBaseProps();
    const { rerender } = render(
      <SettingsView info={null} loading={true} error={null} {...baseProps} />,
    );

    expect(screen.getByText("Loading settings...")).toBeInTheDocument();

    rerender(<SettingsView info={null} loading={false} error="boom" {...baseProps} />);

    expect(screen.getByText("boom")).toBeInTheDocument();
  });

  it("renders settings details and handles control interactions", async () => {
    const user = userEvent.setup();
    const baseProps = createBaseProps();

    render(<SettingsView info={info} loading={false} error={null} {...baseProps} />);

    const sectionHeadings = screen
      .getAllByRole("heading", { level: 3 })
      .map((node) => node.textContent?.trim());
    expect(sectionHeadings.indexOf("Default Expansion")).toBeLessThan(
      sectionHeadings.indexOf("Providers"),
    );
    expect(sectionHeadings.indexOf("Providers")).toBeLessThan(
      sectionHeadings.indexOf("Database Maintenance"),
    );
    expect(screen.getByText("Storage")).toBeInTheDocument();
    expect(screen.getByText("Discovery Roots")).toBeInTheDocument();
    expect(screen.getByText("System Message Rules")).toBeInTheDocument();

    const selects = screen.getAllByRole("combobox");
    expect(selects).toHaveLength(5);
    await user.selectOptions(selects[0] as HTMLElement, "midnight");
    await user.selectOptions(selects[1] as HTMLElement, "current");
    await user.selectOptions(selects[2] as HTMLElement, "13px");
    await user.selectOptions(selects[3] as HTMLElement, "inter");
    await user.selectOptions(selects[4] as HTMLElement, "14px");
    await user.clear(screen.getByRole("textbox", { name: "Zoom" }));
    await user.type(screen.getByRole("textbox", { name: "Zoom" }), "104%");
    await user.tab();

    await user.click(
      screen.getByRole("checkbox", { name: "Use monospaced fonts for all messages" }),
    );
    await user.click(screen.getByRole("checkbox", { name: "Claude" }));
    await user.click(screen.getByRole("button", { name: "Force reindex" }));
    await user.click(
      screen.getByRole("checkbox", {
        name: "Remove indexed sessions when source files disappear during incremental refresh",
      }),
    );
    await user.click(screen.getByRole("button", { name: "User" }));
    await user.click(screen.getByRole("button", { name: "Add claude regex rule" }));
    await user.type(screen.getByRole("textbox", { name: "claude regex rule 1" }), "$");
    await user.click(screen.getByRole("button", { name: "Remove claude regex rule 1" }));

    const copyButtons = screen.getAllByRole("button", { name: /Copy /i });
    const openButtons = screen.getAllByRole("button", { name: /Open /i });
    expect(copyButtons.length).toBeGreaterThan(0);
    expect(openButtons.length).toBeGreaterThan(0);
    await user.click(copyButtons[0] as HTMLElement);
    await user.click(openButtons[0] as HTMLElement);

    expect(baseProps.appearance.onThemeChange).toHaveBeenCalledWith("midnight");
    expect(baseProps.appearance.onZoomPercentChange).toHaveBeenCalledWith(104);
    expect(baseProps.appearance.onMonoFontFamilyChange).toHaveBeenCalledWith("current");
    expect(baseProps.appearance.onMonoFontSizeChange).toHaveBeenCalledWith("13px");
    expect(baseProps.appearance.onRegularFontFamilyChange).toHaveBeenCalledWith("inter");
    expect(baseProps.appearance.onRegularFontSizeChange).toHaveBeenCalledWith("14px");
    expect(baseProps.appearance.onUseMonospaceForAllMessagesChange).toHaveBeenCalledWith(true);
    expect(baseProps.indexing.onToggleProviderEnabled).toHaveBeenCalledWith("claude");
    expect(baseProps.indexing.onForceReindex).toHaveBeenCalledTimes(1);
    expect(
      baseProps.indexing.onRemoveMissingSessionsDuringIncrementalIndexingChange,
    ).toHaveBeenCalledWith(true);
    expect(baseProps.messageRules.onToggleExpandedByDefault).toHaveBeenCalledWith("user");
    expect(baseProps.messageRules.onAddSystemMessageRegexRule).toHaveBeenCalledWith("claude");
    expect(baseProps.messageRules.onUpdateSystemMessageRegexRule).toHaveBeenCalledWith(
      "claude",
      0,
      "^<command-name>$",
    );
    expect(baseProps.messageRules.onRemoveSystemMessageRegexRule).toHaveBeenCalledWith("claude", 0);
    expect(copyTextToClipboard).toHaveBeenCalled();
    expect(openPath).toHaveBeenCalled();
  });

  it("shows diagnostics in a separate tab", async () => {
    const user = userEvent.setup();
    const baseProps = createBaseProps();

    render(<SettingsView info={info} loading={false} error={null} {...baseProps} />);

    await user.click(screen.getByRole("tab", { name: "Diagnostics" }));

    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Manual Incremental Scans")).toBeInTheDocument();
    expect(screen.getByText("Watch-Based Triggers")).toBeInTheDocument();
    expect(screen.getByText("Run Breakdown")).toBeInTheDocument();
    expect(screen.getByText("Trigger type")).toBeInTheDocument();
    expect(screen.getByText("Avg duration")).toBeInTheDocument();
    expect(screen.getByText("Max duration")).toBeInTheDocument();
  });
});

function makeDiagnosticsBucket(
  overrides: Partial<{
    runs: number;
    failedRuns: number;
    totalDurationMs: number;
    averageDurationMs: number;
    maxDurationMs: number;
    lastDurationMs: number | null;
  }> = {},
) {
  return {
    runs: 0,
    failedRuns: 0,
    totalDurationMs: 0,
    averageDurationMs: 0,
    maxDurationMs: 0,
    lastDurationMs: null,
    ...overrides,
  };
}
