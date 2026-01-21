import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";

import { Logger } from "../lib/logger";
import { AppdropError, UsageError } from "../lib/errors";
import { run } from "../lib/exec";
import { loadEnv } from "../lib/env";

export interface SetupCiOptions {
  xcodeOnly: boolean;
  keychainOnly: boolean;
  xcodePath?: string;
  keychainName?: string;
  writeGithubEnv: boolean;
  force: boolean;
  installSparkle: boolean;
}

export function runSetupCi(options: SetupCiOptions, logger: Logger) {
  loadEnv([]);
  if (options.xcodeOnly && options.keychainOnly) {
    throw new UsageError("Use only one of --xcode-only or --keychain-only.");
  }

  const setupXcode = !options.keychainOnly;
  const setupKeychain = !options.xcodeOnly;
  const shouldWriteGithubEnv = options.writeGithubEnv || isGithubActions();

  if (setupXcode) {
    selectXcode(options.xcodePath, logger);
  }

  if (setupKeychain) {
    const { keychainPath, password } = setupKeychainForCi(options, logger);
    if (shouldWriteGithubEnv) {
      writeGithubEnv({ keychainPath, password }, logger);
    } else {
      logger.info(`Keychain ready: ${keychainPath}`);
    }
  }

  const needsSparkle = options.installSparkle || shouldInstallSparkle();
  if (needsSparkle) {
    ensureSparkleTools(logger);
  }
}

function selectXcode(explicitPath: string | undefined, logger: Logger) {
  const xcodePath = resolveXcodePath(explicitPath);
  const developerDir = path.join(xcodePath, "Contents", "Developer");
  const useSudo = shouldUseSudo();
  const command = useSudo ? "sudo" : "xcode-select";
  const args = useSudo ? ["xcode-select", "-s", developerDir] : ["-s", developerDir];

  logger.info(`Selecting Xcode: ${xcodePath}`);
  run(command, args);
  run("xcodebuild", ["-version"]);
}

function setupKeychainForCi(options: SetupCiOptions, logger: Logger) {
  const cert = process.env.DEVELOPER_ID_CERT_P12;
  const password = process.env.DEVELOPER_ID_CERT_PASSWORD;
  if (!cert) {
    throw new AppdropError("Missing DEVELOPER_ID_CERT_P12", 1);
  }
  if (!password) {
    throw new AppdropError("Missing DEVELOPER_ID_CERT_PASSWORD", 1);
  }

  const keychainName = normalizeKeychainName(options.keychainName ?? "appdrop-ci");
  const keychainPassword = crypto.randomBytes(12).toString("hex");

  if (options.force) {
    try {
      run("security", ["delete-keychain", keychainName], { quiet: true });
    } catch {
      // ignore missing keychain
    }
  }

  logger.info(`Creating keychain: ${keychainName}`);
  run("security", ["create-keychain", "-p", keychainPassword, keychainName]);
  run("security", ["set-keychain-settings", "-lut", "21600", keychainName]);
  run("security", ["unlock-keychain", "-p", keychainPassword, keychainName]);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "appdrop-cert-"));
  const certPath = path.join(tempDir, "signing-cert.p12");
  fs.writeFileSync(certPath, Buffer.from(cert, "base64"));

  try {
    run("security", [
      "import",
      certPath,
      "-k",
      keychainName,
      "-P",
      password,
      "-T",
      "/usr/bin/codesign",
      "-T",
      "/usr/bin/security",
    ]);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  run("security", ["list-keychains", "-d", "user", "-s", keychainName]);
  run("security", ["set-key-partition-list", "-S", "apple-tool:,apple:", "-k", keychainPassword, keychainName]);

  return { keychainPath: keychainName, password: keychainPassword };
}

function writeGithubEnv(vars: { keychainPath: string; password: string }, logger: Logger) {
  const envPath = process.env.GITHUB_ENV;
  const payload = `KEYCHAIN_PASSWORD=${vars.password}\nKEYCHAIN_PATH=${vars.keychainPath}\n`;

  if (!envPath) {
    logger.warn("GITHUB_ENV not set; printing keychain env output instead.");
    process.stdout.write(payload);
    return;
  }

  fs.appendFileSync(envPath, payload);
  logger.info("Wrote keychain env values to GITHUB_ENV.");
}

function resolveXcodePath(explicitPath?: string) {
  if (explicitPath) {
    return explicitPath;
  }

  const envPath = process.env.XCODE_PATH;
  if (envPath) {
    return envPath;
  }

  const appsDir = "/Applications";
  const candidates = fs
    .readdirSync(appsDir)
    .filter((entry) => entry.startsWith("Xcode") && entry.endsWith(".app"))
    .sort();

  if (!candidates.length) {
    throw new AppdropError("No Xcode installation found in /Applications", 1);
  }

  return path.join(appsDir, candidates[candidates.length - 1]);
}

function normalizeKeychainName(name: string) {
  return name.endsWith(".keychain") ? name : `${name}.keychain`;
}

function shouldUseSudo() {
  return process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";
}

function isGithubActions() {
  return process.env.GITHUB_ACTIONS === "true" && Boolean(process.env.GITHUB_ENV);
}

function shouldInstallSparkle() {
  return Boolean(process.env.SPARKLE_PRIVATE_KEY);
}

function ensureSparkleTools(logger: Logger) {
  const generateAppcast = "generate_appcast";
  if (commandExists(generateAppcast)) {
    logger.info("Sparkle tools already installed.");
    return;
  }

  logger.info("Installing Sparkle tools (brew install sparkle)...");
  run("brew", ["install", "sparkle"]);
}

function commandExists(command: string) {
  try {
    run("/usr/bin/which", [command], { quiet: true });
    return true;
  } catch {
    return false;
  }
}
