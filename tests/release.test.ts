import { describe, expect, it } from "bun:test";

import { buildArchiveArgs, buildExportArgs } from "../src/lib/release";

describe("release build args", () => {
  it("builds archive args without build mode", () => {
    const args = buildArchiveArgs(
      {
        name: "char",
        projectPath: "/tmp/char.xcodeproj",
        scheme: "char",
      },
      "/tmp/derived",
      "/tmp/char.xcarchive",
      "Developer ID Application: Example (TEAMID1234)"
    );

    expect(args).toContain("archive");
    expect(args).not.toContain("build");
    expect(args).toContain("CODE_SIGN_STYLE=Manual");
    expect(args).toContain("CODE_SIGN_IDENTITY=Developer ID Application: Example (TEAMID1234)");
  });

  it("builds export args", () => {
    const args = buildExportArgs("/tmp/char.xcarchive", "/tmp/export", "/tmp/export.plist");
    expect(args).toContain("-exportArchive");
    expect(args).toContain("/tmp/char.xcarchive");
  });
});
