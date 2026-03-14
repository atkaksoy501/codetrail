type BeforeQuitEvent = {
  preventDefault: () => void;
};

type CreateBeforeQuitHandlerOptions = {
  flushAppState: () => void;
  writeDebugLog: (message: string, details?: unknown, options?: { force?: boolean }) => void;
  shutdownMainProcess: () => Promise<void>;
  exitApp: (exitCode?: number) => void;
  logShutdownError?: (error: unknown) => void;
};

export function createBeforeQuitHandler({
  flushAppState,
  writeDebugLog,
  shutdownMainProcess,
  exitApp,
  logShutdownError,
}: CreateBeforeQuitHandlerOptions): (event: BeforeQuitEvent) => void {
  let shuttingDown = false;

  return (event) => {
    writeDebugLog("before-quit");
    flushAppState();

    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    event.preventDefault();
    void shutdownMainProcess()
      .catch((error) => {
        logShutdownError?.(error);
      })
      .finally(() => {
        exitApp(0);
      });
  };
}
