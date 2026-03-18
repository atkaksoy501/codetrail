import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";

import type { Provider } from "@codetrail/core/browser";

import { reconcileProviderSelection } from "../lib/viewUtils";

export function useReconcileProviderSelection(
  enabledProviders: Provider[],
  setSelection: Dispatch<SetStateAction<Provider[]>>,
): void {
  const previousEnabledProvidersRef = useRef(enabledProviders);

  useEffect(() => {
    const previousEnabled = previousEnabledProvidersRef.current;
    if (
      previousEnabled.length === enabledProviders.length &&
      previousEnabled.every((provider) => enabledProviders.includes(provider))
    ) {
      return;
    }
    previousEnabledProvidersRef.current = enabledProviders;
    setSelection((current) =>
      reconcileProviderSelection(current, previousEnabled, enabledProviders),
    );
  }, [enabledProviders, setSelection]);
}
