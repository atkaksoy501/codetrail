import type { MessageCategory } from "@codetrail/core/browser";

import type { HistorySelectionCommitMode } from "../app/types";

export type HistorySelectionOptions = {
  commitMode?: HistorySelectionCommitMode;
  waitForKeyboardIdle?: boolean;
};

export type AdjacentSelectionOptions = {
  preserveFocus?: boolean;
};

export type HistoryCategoryFilterRestoreState = {
  mode: `solo:${MessageCategory}` | "preset:primary" | "preset:all";
  categories: MessageCategory[];
};
