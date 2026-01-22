import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";

import { Logger } from "../lib/logger";
import { AppdropError, UsageError } from "../lib/errors";
import { run } from "../lib/exec";
import { loadEnv } from "../lib/env";
import { findSparkleTools } from "../lib/pipeline";

export interface SetupCiOptions {
  xcodeOnly: boolean;
  keychainOnly: boolean;
  xcodePath?: string;
  keychainName?: string;
  writeGithubEnv: boolean;
  force: boolean;
  installSparkle: boolean;
}

export interface SetupCiPlan {
  setupXcode: boolean;
  setupKeychain: boolean;
  writeGithubEnv: boolean;
  installSparkle: boolean;
}

export function runSetupCi(options: SetupCiOptions, logger: Logger) {
  loadEnv([]);
  if (options.xcodeOnly && options.keychainOnly) {
    throw new UsageError("Use only one of --xcode-only or --keychain-only.");
  }

  const plan = resolveSetupCiPlan(options);

  if (plan.setupXcode) {
    selectXcode(options.xcodePath, logger);
  }

  if (plan.setupKeychain) {
    const { keychainPath, password } = setupKeychainForCi(options, logger);
    if (plan.writeGithubEnv) {
      writeGithubEnv({ keychainPath, password }, logger);
    } else {
      logger.info(`Keychain ready: ${keychainPath}`);
    }
  }

  if (plan.installSparkle) {
    ensureSparkleTools(logger);
    clearSparkleQuarantine(logger);
    codesignSparkleTools(logger);
  }
}

export function resolveSetupCiPlan(options: SetupCiOptions): SetupCiPlan {
  return {
    setupXcode: !options.keychainOnly,
    setupKeychain: !options.xcodeOnly,
    writeGithubEnv: options.writeGithubEnv || isGithubActions(),
    installSparkle: options.installSparkle || shouldInstallSparkle(),
  };
}

function selectXcode(explicitPath: string | undefined, logger: Logger) {
  const xcodePath = resolveXcodePath(explicitPath);
  const developerDir = path.join(xcodePath, "Contents", "Developer");
  const currentDevDir = run("xcode-select", ["-p"], { quiet: true }).stdout.trim();
  if (currentDevDir === developerDir) {
    logger.info(`Xcode already selected: ${xcodePath}`);
    run("xcodebuild", ["-version"]);
    return;
  }

  if (shouldUseSudo() && !canUseSudo()) {
    throw new AppdropError(
      `Unable to run sudo for xcode-select. Run \"sudo xcode-select -s ${developerDir}\" manually.`,
      1
    );
  }

  logger.info(`Selecting Xcode: ${xcodePath}`);
  run("sudo", ["xcode-select", "-s", developerDir]);
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

  const keychainExists = hasKeychain(keychainName);
  if (keychainExists) {
    if (options.force || isGithubActions()) {
      try {
        run("security", ["delete-keychain", keychainName], { quiet: true });
      } catch {
        // ignore missing keychain
      }
    } else {
      throw new AppdropError(`Keychain already exists: ${keychainName}. Use --force to recreate.`, 1);
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

  const keychainPath = resolveKeychainPath(keychainName);
  run("security", ["list-keychains", "-d", "user", "-s", keychainPath, loginKeychainPath(), systemKeychainPath()]);
  run("security", ["set-key-partition-list", "-S", "apple-tool:,apple:", "-k", keychainPassword, keychainName]);

  return { keychainPath, password: keychainPassword };
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

function canUseSudo() {
  try {
    run("/usr/bin/sudo", ["-n", "true"], { quiet: true });
    return true;
  } catch {
    return false;
  }
}

function hasKeychain(keychainName: string) {
  try {
    run("security", ["show-keychain-info", keychainName], { quiet: true });
    return true;
  } catch {
    return false;
  }
}

function resolveKeychainPath(keychainName: string) {
  if (keychainName.includes("/")) {
    return keychainName;
  }
  const home = process.env.HOME ?? os.homedir();
  const legacy = path.join(home, "Library", "Keychains", keychainName);
  const db = `${legacy}-db`;
  if (fs.existsSync(db)) {
    return db;
  }
  return legacy;
}

function loginKeychainPath() {
  const home = process.env.HOME ?? os.homedir();
  return path.join(home, "Library", "Keychains", "login.keychain-db");
}

function systemKeychainPath() {
  return "/Library/Keychains/System.keychain";
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

function clearSparkleQuarantine(logger: Logger) {
  const tools = findSparkleTools(process.env.SPARKLE_BIN);
  if (!tools) {
    return;
  }

  const targets = [tools.signUpdate, tools.generateAppcast];
  for (const target of targets) {
    try {
      run("xattr", ["-d", "com.apple.quarantine", target], { quiet: true });
      logger.info(`Cleared quarantine: ${target}`);
    } catch {
      // ignore if no quarantine attribute
    }
  }
}

function codesignSparkleTools(logger: Logger) {
  const identity = process.env.DEVELOPER_ID_APPLICATION;
  if (!identity) {
    logger.warn("DEVELOPER_ID_APPLICATION not set; skipping Sparkle tool codesign.");
    return;
  }

  const tools = findSparkleTools(process.env.SPARKLE_BIN);
  if (!tools) {
    return;
  }

  const targets = [tools.signUpdate, tools.generateAppcast];
  for (const target of targets) {
    try {
      run("/usr/bin/codesign", ["--force", "--options", "runtime", "--timestamp", "--sign", identity, target]);
      logger.info(`Codesigned Sparkle tool: ${target}`);
    } catch (error) {
      logger.warn(`Failed to codesign Sparkle tool: ${target}`);
    }
  }
}

function commandExists(command: string) {
  try {
    run("/usr/bin/which", [command], { quiet: true });
    return true;
  } catch {
    return false;
  }
}
