export function shouldIgnoreAsyncEffectError(cancelled: boolean, error: unknown): boolean {
  if (cancelled) {
    return true;
  }
  if (!(error instanceof Error)) {
    return false;
  }
  return error.name === "AbortError" || /cancel/i.test(error.message);
}
