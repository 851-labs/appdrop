import { describe, expect, it } from "bun:test";

import { resolveSetupCiPlan, shouldDeleteKeychain } from "../src/commands/setup-ci";

describe("setup-ci planning", () => {
  it("defaults to both setup steps", () => {
    withEnv({ GITHUB_ACTIONS: undefined, GITHUB_ENV: undefined, SPARKLE_PRIVATE_KEY: undefined }, () => {
      const plan = resolveSetupCiPlan(baseOptions());
      expect(plan.setupXcode).toBeTrue();
      expect(plan.setupKeychain).toBeTrue();
      expect(plan.writeGithubEnv).toBeFalse();
      expect(plan.installSparkle).toBeFalse();
    });
  });

  it("auto-writes GitHub env in actions", () => {
    withEnv({ GITHUB_ACTIONS: "true", GITHUB_ENV: "/tmp/github-env", SPARKLE_PRIVATE_KEY: undefined }, () => {
      const plan = resolveSetupCiPlan(baseOptions());
      expect(plan.writeGithubEnv).toBeTrue();
    });
  });

  it("auto-installs sparkle when key present", () => {
    withEnv({ GITHUB_ACTIONS: undefined, GITHUB_ENV: undefined, SPARKLE_PRIVATE_KEY: "key" }, () => {
      const plan = resolveSetupCiPlan(baseOptions());
      expect(plan.installSparkle).toBeTrue();
    });
  });

  it("respects xcode-only and keychain-only flags", () => {
    const xcodeOnly = resolveSetupCiPlan({ ...baseOptions(), xcodeOnly: true });
    expect(xcodeOnly.setupXcode).toBeTrue();
    expect(xcodeOnly.setupKeychain).toBeFalse();

    const keychainOnly = resolveSetupCiPlan({ ...baseOptions(), keychainOnly: true });
    expect(keychainOnly.setupXcode).toBeFalse();
    expect(keychainOnly.setupKeychain).toBeTrue();
  });

  it("deletes keychain in GitHub Actions", () => {
    withEnv({ GITHUB_ACTIONS: "true", GITHUB_ENV: "/tmp/github-env" }, () => {
      expect(shouldDeleteKeychain(baseOptions())).toBeTrue();
    });
  });

  it("deletes keychain when forced", () => {
    withEnv({ GITHUB_ACTIONS: undefined, GITHUB_ENV: undefined }, () => {
      expect(shouldDeleteKeychain({ ...baseOptions(), force: true })).toBeTrue();
    });
  });
});

function baseOptions() {
  return {
    xcodeOnly: false,
    keychainOnly: false,
    xcodePath: undefined,
    keychainName: undefined,
    writeGithubEnv: false,
    force: false,
    installSparkle: false,
  };
}

function withEnv(temp: Record<string, string | undefined>, fn: () => void) {
  const previous: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(temp)) {
    previous[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}
