import { describe, expect, it } from "vitest";

import { parseWorkspaceYaml } from "./copilotCli";

describe("parseWorkspaceYaml", () => {
  it("parses all fields from a well-formed yaml", () => {
    const content = [
      "id: session-abc-123",
      "cwd: /home/user/projects/myapp",
      "repository: owner/myapp",
      "branch: main",
      "summary: Fix login bug",
    ].join("\n");

    expect(parseWorkspaceYaml(content)).toEqual({
      id: "session-abc-123",
      cwd: "/home/user/projects/myapp",
      repository: "owner/myapp",
      branch: "main",
      summary: "Fix login bug",
    });
  });

  it("handles values with colons (e.g. cwd paths on Windows or URLs)", () => {
    const content = [
      "id: session-001",
      "cwd: C:/Users/user/projects/myapp",
      "repository: owner/myapp",
      "branch: feat/some-feature",
      "summary: Add feature: support colons in paths",
    ].join("\n");

    const result = parseWorkspaceYaml(content);
    expect(result.cwd).toBe("C:/Users/user/projects/myapp");
    expect(result.branch).toBe("feat/some-feature");
    expect(result.summary).toBe("Add feature: support colons in paths");
  });

  it("handles CRLF line endings", () => {
    const content = "id: session-001\r\ncwd: /home/user/project\r\nbranch: main\r\n";
    const result = parseWorkspaceYaml(content);
    expect(result.id).toBe("session-001");
    expect(result.cwd).toBe("/home/user/project");
    expect(result.branch).toBe("main");
  });

  it("returns nulls for empty input", () => {
    expect(parseWorkspaceYaml("")).toEqual({
      id: null,
      cwd: null,
      repository: null,
      branch: null,
      summary: null,
    });
  });

  it("returns nulls for whitespace-only input", () => {
    expect(parseWorkspaceYaml("   \n  \n")).toEqual({
      id: null,
      cwd: null,
      repository: null,
      branch: null,
      summary: null,
    });
  });

  it("skips lines without colons", () => {
    const content = "id: session-001\nno colon here\ncwd: /home/user\n";
    const result = parseWorkspaceYaml(content);
    expect(result.id).toBe("session-001");
    expect(result.cwd).toBe("/home/user");
  });

  it("skips keys with empty values", () => {
    const content = "id: session-001\ncwd: \nbranch: main\n";
    const result = parseWorkspaceYaml(content);
    expect(result.id).toBe("session-001");
    expect(result.cwd).toBeNull();
    expect(result.branch).toBe("main");
  });

  it("ignores unknown keys", () => {
    const content = "id: session-001\nunknown_key: some_value\ncwd: /home/user\n";
    const result = parseWorkspaceYaml(content);
    expect(result.id).toBe("session-001");
    expect(result.cwd).toBe("/home/user");
  });

  it("trims whitespace from keys and values", () => {
    const content = "  id  :  session-001  \n  cwd  :  /home/user  \n";
    const result = parseWorkspaceYaml(content);
    expect(result.id).toBe("session-001");
    expect(result.cwd).toBe("/home/user");
  });
});
