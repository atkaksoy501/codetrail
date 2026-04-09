import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { useClickOutside } from "../../hooks/useClickOutside";
import { usePaneFocusOverlay } from "../../lib/paneFocusController";
import { ToolbarIcon, type ToolbarIconName } from "../ToolbarIcon";

type ContextMenuItem = {
  id: string;
  label: string;
  icon: ToolbarIconName;
  disabled?: boolean;
  tone?: "default" | "danger";
  onSelect: () => void;
};

export function HistoryListContextMenu({
  open,
  x,
  y,
  groups,
  onClose,
}: {
  open: boolean;
  x: number;
  y: number;
  groups: ContextMenuItem[][];
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({ left: x, top: y });
  usePaneFocusOverlay(open);

  useClickOutside(menuRef, open, onClose);

  useEffect(() => {
    if (!open) {
      return;
    }
    setPosition({ left: x, top: y });
  }, [open, x, y]);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    const menu = menuRef.current;
    if (!menu) {
      return;
    }

    const viewportPadding = 8;
    const nextLeft = Math.max(
      viewportPadding,
      Math.min(x, window.innerWidth - menu.offsetWidth - viewportPadding),
    );
    const nextTop = Math.max(
      viewportPadding,
      Math.min(y, window.innerHeight - menu.offsetHeight - viewportPadding),
    );
    if (nextLeft !== position.left || nextTop !== position.top) {
      setPosition({ left: nextLeft, top: nextTop });
    }
  }, [open, position.left, position.top, x, y]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    const onViewportChange = () => {
      onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      className="tb-dropdown-menu history-list-context-menu"
      role="menu"
      style={{ left: position.left, top: position.top }}
    >
      {groups.map((group, groupIndex) => (
        <div key={group.map((item) => item.id).join(":")} className="history-list-context-group">
          {groupIndex > 0 ? <div className="tb-dropdown-separator" /> : null}
          {group.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className={`tb-dropdown-item history-list-context-item${
                item.tone === "danger" ? " danger" : ""
              }`}
              disabled={item.disabled}
              onClick={() => {
                if (item.disabled) {
                  return;
                }
                item.onSelect();
                onClose();
              }}
            >
              <span className="history-list-context-item-icon">
                <ToolbarIcon name={item.icon} />
              </span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
