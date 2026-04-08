export type VisibleExpansionAction = "expand" | "collapse" | "restore";

export function deriveVisibleExpansionAction(
  items: Array<{ currentExpanded: boolean; atDefault: boolean }>,
): VisibleExpansionAction {
  if (items.length === 0) {
    return "expand";
  }
  const areAllExpanded = items.every((item) => item.currentExpanded);
  const areAllCollapsed = items.every((item) => !item.currentExpanded);
  const areAllAtDefault = items.every((item) => item.atDefault);
  if (areAllExpanded) {
    return "collapse";
  }
  if (areAllCollapsed) {
    return "restore";
  }
  if (areAllAtDefault) {
    return "expand";
  }
  return "expand";
}

export function getNextVisibleExpansionAction(
  action: VisibleExpansionAction,
): VisibleExpansionAction {
  if (action === "expand") {
    return "collapse";
  }
  if (action === "collapse") {
    return "restore";
  }
  return "expand";
}
