import { describe, expect, it } from "bun:test";
import { levenshtein, suggest } from "../src/lib/suggest";

describe("levenshtein", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshtein("test", "test")).toBe(0);
  });

  it("returns length for empty string comparison", () => {
    expect(levenshtein("", "test")).toBe(4);
    expect(levenshtein("test", "")).toBe(4);
  });

  it("counts single insertion", () => {
    expect(levenshtein("relase", "release")).toBe(1);
  });

  it("counts single deletion", () => {
    expect(levenshtein("buiild", "build")).toBe(1);
  });

  it("counts single substitution", () => {
    expect(levenshtein("test", "tast")).toBe(1);
  });

  it("counts multiple edits", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
  });

  it("handles completely different strings", () => {
    expect(levenshtein("abc", "xyz")).toBe(3);
  });
});

describe("suggest", () => {
  const commands = ["release", "build", "doctor", "publish"] as const;

  it("suggests closest match within threshold", () => {
    expect(suggest("relase", commands)).toBe("release");
    expect(suggest("relaese", commands)).toBe("release");
    expect(suggest("buld", commands)).toBe("build");
    expect(suggest("doctr", commands)).toBe("doctor");
    expect(suggest("publsh", commands)).toBe("publish");
  });

  it("returns null when no match within threshold", () => {
    expect(suggest("xyz", commands)).toBeNull();
    expect(suggest("foobar", commands)).toBeNull();
  });

  it("is case insensitive", () => {
    expect(suggest("RELEASE", commands)).toBe("release");
    expect(suggest("Release", commands)).toBe("release");
  });

  it("respects custom maxDistance", () => {
    expect(suggest("xyz", commands, 1)).toBeNull();
    expect(suggest("releasexxx", commands, 2)).toBeNull(); // distance is 3
    expect(suggest("releasexxx", commands, 3)).toBe("release");
  });

  it("returns exact match", () => {
    expect(suggest("release", commands)).toBe("release");
  });

  describe("flag suggestions", () => {
    const flags = ["--scheme", "--project", "--output", "--verbose", "--help"] as const;

    it("suggests closest flag", () => {
      expect(suggest("--schem", flags)).toBe("--scheme");
      expect(suggest("--sheme", flags)).toBe("--scheme");
      expect(suggest("--projct", flags)).toBe("--project");
      expect(suggest("--outpt", flags)).toBe("--output");
    });

    it("handles short flags", () => {
      const allFlags = ["-v", "-h", "--verbose", "--help"] as const;
      expect(suggest("-vv", allFlags)).toBe("-v");
    });
  });
});
