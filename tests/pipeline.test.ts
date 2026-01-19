import { describe, expect, it } from "bun:test";
import { detectPipeline } from "../src/lib/pipeline";
import { findProject } from "../src/lib/project";
import path from "path";

const fixturesRoot = path.join(import.meta.dir, "fixtures");

describe("pipeline detection", () => {
  it("detects sparkle enabled when keys + tools", () => {
    const root = path.join(fixturesRoot, "sparkle-on");
    const project = findProject(root, undefined, "sparkle-on.xcodeproj");
    const pipeline = detectPipeline(project, { sparkleBin: path.join(root, "tools") });
    expect(pipeline.sparkle).toBeTrue();
    expect(pipeline.generateAppcast).toBeTrue();
    expect(pipeline.missingEntitlements).toBeFalse();
  });

  it("disables sparkle when tools missing", () => {
    const root = path.join(fixturesRoot, "sparkle-on");
    const project = findProject(root, undefined, "sparkle-on.xcodeproj");
    const pipeline = detectPipeline(project, { sparkleBin: path.join(root, "missing-tools") });
    expect(pipeline.sparkle).toBeFalse();
  });

  it("allows missing info plist when sparkle off", () => {
    const root = path.join(fixturesRoot, "no-info");
    const project = findProject(root, undefined, "no-info.xcodeproj");
    const pipeline = detectPipeline(project, {});
    expect(pipeline.missingInfoPlist).toBeFalse();
  });

  it("handles sparkle disabled project", () => {
    const root = path.join(fixturesRoot, "sparkle-off");
    const project = findProject(root, undefined, "sparkle-off.xcodeproj");
    const pipeline = detectPipeline(project, {});
    expect(pipeline.sparkle).toBeFalse();
    expect(pipeline.generateAppcast).toBeFalse();
  });

  it("flags missing entitlements for non-sparkle projects", () => {
    const root = path.join(fixturesRoot, "missing-entitlements");
    const project = findProject(root, undefined, "missing-entitlements.xcodeproj");
    const pipeline = detectPipeline(project, {});
    expect(pipeline.missingEntitlements).toBeTrue();
  });
});
