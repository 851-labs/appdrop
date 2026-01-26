import { describe, expect, it } from "bun:test";

import { parseArgs, commandHelpText, VALID_COMMANDS } from "../src/lib/cli";
import { UsageError } from "../src/lib/errors";

describe("parseArgs", () => {
  describe("global help flags", () => {
    it("parses -h as global help", () => {
      const result = parseArgs(["-h"]);
      expect(result.flags.help).toBe(true);
      expect(result.command).toBe("release");
      expect(result.helpCommand).toBeUndefined();
    });

    it("parses --help as global help", () => {
      const result = parseArgs(["--help"]);
      expect(result.flags.help).toBe(true);
      expect(result.command).toBe("release");
      expect(result.helpCommand).toBeUndefined();
    });

    it("parses -h at any position", () => {
      const result = parseArgs(["--verbose", "-h"]);
      expect(result.flags.help).toBe(true);
    });
  });

  describe("help subcommand", () => {
    it("parses 'help' as global help", () => {
      const result = parseArgs(["help"]);
      expect(result.flags.help).toBe(true);
      expect(result.command).toBe("help");
      expect(result.helpCommand).toBeUndefined();
    });

    it("parses 'help build' as build command help", () => {
      const result = parseArgs(["help", "build"]);
      expect(result.flags.help).toBe(true);
      expect(result.command).toBe("help");
      expect(result.helpCommand).toBe("build");
    });

    it("parses 'help release' as release command help", () => {
      const result = parseArgs(["help", "release"]);
      expect(result.flags.help).toBe(true);
      expect(result.helpCommand).toBe("release");
    });

    it("parses 'help setup-ci' as setup-ci command help", () => {
      const result = parseArgs(["help", "setup-ci"]);
      expect(result.flags.help).toBe(true);
      expect(result.helpCommand).toBe("setup-ci");
    });
  });

  describe("per-command help", () => {
    it("parses 'build --help' as build command help", () => {
      const result = parseArgs(["build", "--help"]);
      expect(result.flags.help).toBe(true);
      expect(result.command).toBe("build");
      expect(result.helpCommand).toBe("build");
    });

    it("parses 'build -h' as build command help", () => {
      const result = parseArgs(["build", "-h"]);
      expect(result.flags.help).toBe(true);
      expect(result.command).toBe("build");
      expect(result.helpCommand).toBe("build");
    });

    it("parses 'dmg --help' as dmg command help", () => {
      const result = parseArgs(["dmg", "--help"]);
      expect(result.flags.help).toBe(true);
      expect(result.command).toBe("dmg");
      expect(result.helpCommand).toBe("dmg");
    });
  });

  describe("version flag", () => {
    it("parses --version", () => {
      const result = parseArgs(["--version"]);
      expect(result.flags.version).toBe(true);
    });

    it("parses --version at any position", () => {
      const result = parseArgs(["build", "--version"]);
      expect(result.flags.version).toBe(true);
    });
  });

  describe("command parsing", () => {
    it("defaults to release when no command given", () => {
      const result = parseArgs([]);
      expect(result.command).toBe("release");
    });

    it("defaults to release when only flags given", () => {
      const result = parseArgs(["--verbose"]);
      expect(result.command).toBe("release");
    });

    it("parses build command", () => {
      const result = parseArgs(["build"]);
      expect(result.command).toBe("build");
    });

    it("parses unknown commands", () => {
      const result = parseArgs(["foo"]);
      expect(result.command).toBe("foo");
    });
  });
});

describe("commandHelpText", () => {
  it("returns help text for valid commands", () => {
    for (const cmd of VALID_COMMANDS) {
      const text = commandHelpText(cmd);
      expect(text).toContain("EXAMPLES:");
      expect(text).toContain("FLAGS:");
    }
  });

  it("returns error message for unknown commands", () => {
    const text = commandHelpText("unknown");
    expect(text).toContain("Unknown command: unknown");
    expect(text).toContain("appdrop --help");
  });

  it("includes command description", () => {
    const text = commandHelpText("release");
    expect(text).toContain("Build, sign, notarize, and package");
  });

  it("includes command-specific flags", () => {
    const text = commandHelpText("dmg");
    expect(text).toContain("--app-path");
  });

  it("includes global flags section", () => {
    const text = commandHelpText("build");
    expect(text).toContain("GLOBAL FLAGS:");
    expect(text).toContain("--quiet");
    expect(text).toContain("--verbose");
  });
});

describe("VALID_COMMANDS", () => {
  it("contains all expected commands", () => {
    expect(VALID_COMMANDS).toContain("release");
    expect(VALID_COMMANDS).toContain("build");
    expect(VALID_COMMANDS).toContain("dmg");
    expect(VALID_COMMANDS).toContain("notarize");
    expect(VALID_COMMANDS).toContain("appcast");
    expect(VALID_COMMANDS).toContain("doctor");
    expect(VALID_COMMANDS).toContain("setup-ci");
    expect(VALID_COMMANDS).toContain("publish");
  });
});

describe("--executable flag", () => {
  it("parses --executable flag", () => {
    const result = parseArgs(["release", "--executable", "mycli"]);
    expect(result.flags.executable).toBe("mycli");
  });

  it("passes executable to release options", () => {
    const result = parseArgs(["--executable", "custom-name"]);
    expect(result.command).toBe("release");
    expect(result.flags.executable).toBe("custom-name");
  });
});

describe("error handling", () => {
  describe("missing flag values", () => {
    it("throws UsageError when --scheme has no value", () => {
      expect(() => parseArgs(["release", "--scheme"])).toThrow(UsageError);
    });

    it("throws UsageError when -s has no value", () => {
      expect(() => parseArgs(["build", "-s"])).toThrow(UsageError);
    });

    it("throws UsageError when --output has no value", () => {
      expect(() => parseArgs(["release", "--output"])).toThrow(UsageError);
    });

    it("includes command context in error", () => {
      try {
        parseArgs(["build", "--scheme"]);
      } catch (error) {
        expect(error).toBeInstanceOf(UsageError);
        const usageError = error as UsageError;
        expect(usageError.message).toBe("--scheme requires a value");
        expect(usageError.command).toBe("build");
        expect(usageError.hint).toContain("appdrop build --help");
      }
    });

    it("treats flag-like value as missing value", () => {
      expect(() => parseArgs(["release", "--scheme", "--verbose"])).toThrow(UsageError);
    });
  });

  describe("unknown flags", () => {
    it("throws UsageError for unknown flag", () => {
      expect(() => parseArgs(["release", "--unknown-flag"])).toThrow(UsageError);
    });

    it("includes command context in unknown flag error", () => {
      try {
        parseArgs(["doctor", "--foobar"]);
      } catch (error) {
        expect(error).toBeInstanceOf(UsageError);
        const usageError = error as UsageError;
        expect(usageError.message).toContain("Unknown flag: --foobar");
        expect(usageError.command).toBe("doctor");
        expect(usageError.hint).toContain("appdrop doctor --help");
      }
    });

    it("suggests similar flag in error message", () => {
      try {
        parseArgs(["release", "--schem"]);
      } catch (error) {
        expect(error).toBeInstanceOf(UsageError);
        const usageError = error as UsageError;
        expect(usageError.message).toContain("Did you mean: --scheme");
      }
    });

    it("throws for unknown short flag", () => {
      expect(() => parseArgs(["release", "-x"])).toThrow(UsageError);
    });
  });
});
