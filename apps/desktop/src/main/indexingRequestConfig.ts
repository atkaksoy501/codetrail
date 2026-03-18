import type { Provider, SystemMessageRegexRuleOverrides } from "@codetrail/core";

export type SharedIndexingRequestSettings = {
  enabledProviders?: Provider[];
  removeMissingSessionsDuringIncrementalIndexing?: boolean;
  systemMessageRegexRules?: SystemMessageRegexRuleOverrides;
};

type SharedIndexingRequestSettingsInput = {
  enabledProviders?: Provider[] | undefined;
  removeMissingSessionsDuringIncrementalIndexing?: boolean | undefined;
  systemMessageRegexRules?: SystemMessageRegexRuleOverrides | undefined;
};

export type IncrementalWorkerRequest = {
  kind: "incremental";
  dbPath: string;
  forceReindex: boolean;
} & SharedIndexingRequestSettings;

export type ChangedFilesWorkerRequest = {
  kind: "changedFiles";
  dbPath: string;
  changedFilePaths: string[];
} & SharedIndexingRequestSettings;

export type IndexingWorkerRequest = IncrementalWorkerRequest | ChangedFilesWorkerRequest;

export function buildSharedIndexingRequestSettings(
  settings: SharedIndexingRequestSettingsInput,
): SharedIndexingRequestSettings {
  const next: SharedIndexingRequestSettings = {};
  if (settings.enabledProviders) {
    next.enabledProviders = settings.enabledProviders;
  }
  if (settings.removeMissingSessionsDuringIncrementalIndexing !== undefined) {
    next.removeMissingSessionsDuringIncrementalIndexing =
      settings.removeMissingSessionsDuringIncrementalIndexing;
  }
  if (settings.systemMessageRegexRules) {
    next.systemMessageRegexRules = settings.systemMessageRegexRules;
  }
  return next;
}

export function toIncrementalIndexingConfig(request: IncrementalWorkerRequest) {
  return {
    dbPath: request.dbPath,
    forceReindex: request.forceReindex,
    ...buildSharedIndexingRequestSettings(request),
  };
}

export function toChangedFilesIndexingConfig(request: ChangedFilesWorkerRequest) {
  return {
    dbPath: request.dbPath,
    ...buildSharedIndexingRequestSettings(request),
  };
}
