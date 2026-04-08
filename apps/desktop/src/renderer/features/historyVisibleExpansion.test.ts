import { describe, expect, it } from "vitest";

import {
  deriveVisibleExpansionAction,
  getNextVisibleExpansionAction,
} from "./historyVisibleExpansion";

describe("historyVisibleExpansion", () => {
  it("starts with expand when there are no visible items", () => {
    expect(deriveVisibleExpansionAction([])).toBe("expand");
  });

  it("returns collapse when all visible items are expanded", () => {
    expect(
      deriveVisibleExpansionAction([
        { currentExpanded: true, atDefault: true },
        { currentExpanded: true, atDefault: false },
      ]),
    ).toBe("collapse");
  });

  it("returns restore when all visible items are collapsed", () => {
    expect(
      deriveVisibleExpansionAction([
        { currentExpanded: false, atDefault: false },
        { currentExpanded: false, atDefault: false },
      ]),
    ).toBe("restore");
  });

  it("returns expand when all visible items are already at their defaults", () => {
    expect(
      deriveVisibleExpansionAction([
        { currentExpanded: true, atDefault: true },
        { currentExpanded: false, atDefault: true },
      ]),
    ).toBe("expand");
  });

  it("cycles expand to collapse to restore and back to expand", () => {
    expect(getNextVisibleExpansionAction("expand")).toBe("collapse");
    expect(getNextVisibleExpansionAction("collapse")).toBe("restore");
    expect(getNextVisibleExpansionAction("restore")).toBe("expand");
  });
});
