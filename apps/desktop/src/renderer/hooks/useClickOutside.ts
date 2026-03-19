import { useEffect, useRef } from "react";
import type { RefObject } from "react";

export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  enabled: boolean,
  onClickOutside: () => void,
): void {
  const onClickOutsideRef = useRef(onClickOutside);

  useEffect(() => {
    onClickOutsideRef.current = onClickOutside;
  }, [onClickOutside]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || ref.current?.contains(target)) {
        return;
      }
      onClickOutsideRef.current();
    };

    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [enabled, ref]);
}
