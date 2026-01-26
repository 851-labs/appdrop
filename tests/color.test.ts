import { describe, expect, it } from "bun:test";
import { spawnSync } from "child_process";

describe("color", () => {
  // Test color via subprocess to properly isolate env
  function runWithEnv(env: Record<string, string>, code: string): string {
    const result = spawnSync("bun", ["-e", code], {
      env: { ...process.env, ...env },
      encoding: "utf-8",
    });
    return result.stdout;
  }

  describe("NO_COLOR support", () => {
    it("disables color when NO_COLOR is set", () => {
      const output = runWithEnv(
        { NO_COLOR: "1" },
        `import { color } from "./src/lib/color"; console.log(color.red("test"))`
      );
      expect(output.trim()).toBe("test");
    });

    it("disables color when NO_COLOR is empty string", () => {
      const output = runWithEnv(
        { NO_COLOR: "" },
        `import { color } from "./src/lib/color"; console.log(color.red("test"))`
      );
      expect(output.trim()).toBe("test");
    });
  });

  describe("FORCE_COLOR support", () => {
    it("enables color when FORCE_COLOR is set", () => {
      const output = runWithEnv(
        { FORCE_COLOR: "1" },
        `import { color } from "./src/lib/color"; console.log(color.red("test"))`
      );
      expect(output).toContain("\x1b[31m");
      expect(output).toContain("\x1b[0m");
    });
  });

  describe("color functions with FORCE_COLOR", () => {
    it("applies red color", () => {
      const output = runWithEnv(
        { FORCE_COLOR: "1" },
        `import { color } from "./src/lib/color"; console.log(color.red("error"))`
      );
      expect(output).toContain("\x1b[31m");
    });

    it("applies green color", () => {
      const output = runWithEnv(
        { FORCE_COLOR: "1" },
        `import { color } from "./src/lib/color"; console.log(color.green("success"))`
      );
      expect(output).toContain("\x1b[32m");
    });

    it("applies yellow color", () => {
      const output = runWithEnv(
        { FORCE_COLOR: "1" },
        `import { color } from "./src/lib/color"; console.log(color.yellow("warning"))`
      );
      expect(output).toContain("\x1b[33m");
    });
  });

  describe("symbols", () => {
    it("provides success symbol", () => {
      const output = runWithEnv(
        { FORCE_COLOR: "1" },
        `import { symbols } from "./src/lib/color"; console.log(symbols.success)`
      );
      expect(output).toContain("✓");
    });

    it("provides error symbol", () => {
      const output = runWithEnv(
        { FORCE_COLOR: "1" },
        `import { symbols } from "./src/lib/color"; console.log(symbols.error)`
      );
      expect(output).toContain("✗");
    });
  });

  describe("style helpers", () => {
    it("style.success uses green", () => {
      const output = runWithEnv(
        { FORCE_COLOR: "1" },
        `import { style } from "./src/lib/color"; console.log(style.success("done"))`
      );
      expect(output).toContain("\x1b[32m");
    });

    it("style.error uses red", () => {
      const output = runWithEnv(
        { FORCE_COLOR: "1" },
        `import { style } from "./src/lib/color"; console.log(style.error("failed"))`
      );
      expect(output).toContain("\x1b[31m");
    });

    it("style.warn uses yellow", () => {
      const output = runWithEnv(
        { FORCE_COLOR: "1" },
        `import { style } from "./src/lib/color"; console.log(style.warn("caution"))`
      );
      expect(output).toContain("\x1b[33m");
    });
  });

  describe("NO_COLOR takes precedence over FORCE_COLOR", () => {
    it("NO_COLOR wins when both are set", () => {
      const output = runWithEnv(
        { NO_COLOR: "1", FORCE_COLOR: "1" },
        `import { color } from "./src/lib/color"; console.log(color.red("test"))`
      );
      expect(output.trim()).toBe("test");
    });
  });
});
