import type { HistoryExportPhase } from "../../shared/historyExport";
import type { HistoryExportScope } from "../app/types";

export type RefreshContext = {
  refreshId: number;
  originPage: number;
  scopeKey: string;
  baselineTotalCount: number;
  followEligible: boolean;
  scrollPreservation: {
    scrollTop: number;
    referenceMessageId: string;
    referenceOffsetTop: number;
  } | null;
  prevMessageIds: string;
};

export type HistoryExportState = {
  open: boolean;
  exportId: string | null;
  scope: HistoryExportScope;
  percent: number;
  phase: HistoryExportPhase;
  message: string;
};
