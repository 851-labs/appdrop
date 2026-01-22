import fs from "fs";
import path from "path";
import { run } from "./exec";
import { ProjectInfo } from "./project";
import { Pipeline, SparkleTools } from "./pipeline";
import { AppdropError } from "./errors";

export interface ReleaseContext {
  project: ProjectInfo;
  pipeline: Pipeline;
  env: Record<string, string>;
}

export function runReleasePipeline(context: ReleaseContext) {
  const { project, pipeline, env } = context;

  const buildDir = pipeline.buildDir;
  const derivedData = path.join(buildDir, "DerivedData");
  const appPath = path.join(buildDir, `${project.name}.app`);
  const appZip = path.join(buildDir, `${project.name}.zip`);
  const dmgPath = path.join(buildDir, `${project.name}.dmg`);
  const releaseDir = pipeline.outputDir;

  fs.mkdirSync(buildDir, { recursive: true });
  fs.mkdirSync(releaseDir, { recursive: true });

  const needsNotary = pipeline.notarizeApp || pipeline.notarizeDmg;
  const notaryKeyPath = needsNotary ? writeNotaryKey(buildDir, env.APP_STORE_CONNECT_PRIVATE_KEY) : null;
  const entitlementsDir = fs.mkdtempSync(path.join(buildDir, "entitlements-"));

  try {
    const bundleId = resolveBundleIdentifier(project);
    const appEntitlementsPath = prepareEntitlements(pipeline.entitlementsPath, bundleId, entitlementsDir, "app");
    const sparkleEntitlementsPath = prepareEntitlements(
      pipeline.sparkleEntitlementsPath,
      bundleId,
      entitlementsDir,
      "sparkle"
    );

    buildApp(project, derivedData, env.DEVELOPER_ID_APPLICATION);

    const builtApp = path.join(derivedData, "Build/Products", "Release", `${project.name}.app`);
    ensureDirectory(builtApp, "Built app not found");

    fs.rmSync(appPath, { recursive: true, force: true });
    fs.rmSync(dmgPath, { force: true });
    fs.rmSync(appZip, { force: true });
    fs.cpSync(builtApp, appPath, { recursive: true });

    signSparkle(appPath, env.DEVELOPER_ID_APPLICATION, sparkleEntitlementsPath);
    signApp(appPath, env.DEVELOPER_ID_APPLICATION, appEntitlementsPath);

    if (pipeline.notarizeApp) {
      if (!notaryKeyPath) {
        throw new AppdropError("Missing notarization key", 3);
      }
      run("/usr/bin/ditto", ["-c", "-k", "--keepParent", appPath, appZip]);
      notarizeArtifact(notaryKeyPath, env, appZip, "app");
      run("xcrun", ["stapler", "staple", appPath]);
      fs.rmSync(appZip, { force: true });
    }

    if (pipeline.createDmg) {
      createDmg(appPath, dmgPath, project.name, env.DEVELOPER_ID_APPLICATION);

      if (pipeline.notarizeDmg) {
        if (!notaryKeyPath) {
          throw new AppdropError("Missing notarization key", 3);
        }
        notarizeArtifact(notaryKeyPath, env, dmgPath, "dmg");
        run("xcrun", ["stapler", "staple", dmgPath]);
      }

      fs.cpSync(dmgPath, path.join(releaseDir, path.basename(dmgPath)));

      if (pipeline.generateAppcast && pipeline.sparkleTools) {
        generateAppcast(pipeline.sparkleTools, dmgPath, releaseDir, env.SPARKLE_PRIVATE_KEY);
      }
    }
  } finally {
    if (notaryKeyPath) {
      fs.rmSync(path.dirname(notaryKeyPath), { recursive: true, force: true });
    }
    fs.rmSync(entitlementsDir, { recursive: true, force: true });
  }
}

export function buildApp(project: ProjectInfo, derivedData: string, identity: string) {
  run("xcodebuild", [
    "-project",
    project.projectPath,
    "-scheme",
    project.scheme,
    "-configuration",
    "Release",
    "-derivedDataPath",
    derivedData,
    "-destination",
    "platform=macOS,arch=arm64",
    `CODE_SIGN_IDENTITY=${identity}`,
    "CODE_SIGN_STYLE=Manual",
    "build",
  ]);
}

export function signApp(appPath: string, identity: string, entitlementsPath: string | null) {
  if (!entitlementsPath) {
    throw new AppdropError("Missing app entitlements", 2);
  }
  run("/usr/bin/codesign", [
    "--force",
    "--options",
    "runtime",
    "--timestamp",
    "--entitlements",
    entitlementsPath,
    "--sign",
    identity,
    appPath,
  ]);
}

export function signSparkle(appPath: string, identity: string, sparkleEntitlementsPath: string | null) {
  const sparkleFramework = path.join(appPath, "Contents/Frameworks/Sparkle.framework");
  if (!fs.existsSync(sparkleFramework)) {
    return;
  }

  // Follow Sparkle's standard workflow: do not re-sign Sparkle helpers here.
  // Signing Sparkle's embedded services is handled by Sparkle/Xcode distribution.
}

export function createDmg(appPath: string, dmgPath: string, name: string, identity: string) {
  const dmgDir = path.join(path.dirname(dmgPath), "dmg");
  fs.rmSync(dmgDir, { recursive: true, force: true });
  fs.mkdirSync(dmgDir, { recursive: true });
  fs.cpSync(appPath, path.join(dmgDir, `${name}.app`), { recursive: true });

  run("hdiutil", [
    "create",
    "-volname",
    name,
    "-srcfolder",
    dmgDir,
    "-ov",
    "-format",
    "UDZO",
    dmgPath,
  ]);

  run("codesign", ["--force", "--timestamp", "--sign", identity, dmgPath]);
}

export function signIfExists(target: string, identity: string, entitlementsPath: string | null) {
  if (!fs.existsSync(target)) {
    return;
  }

  const args = ["/usr/bin/codesign", "--force", "--options", "runtime", "--timestamp", "--sign", identity];
  if (entitlementsPath) {
    args.push("--entitlements", entitlementsPath);
  }
  args.push(target);
  run(args[0], args.slice(1));
}


export function notarizeArtifact(notaryKeyPath: string, env: Record<string, string>, target: string, label: string) {
  const timeoutMs = parseDuration(process.env.APPDROP_NOTARY_TIMEOUT ?? "2h");
  const pollMs = parseDuration(process.env.APPDROP_NOTARY_POLL ?? "30s");
  const deadline = Date.now() + timeoutMs;
  const submitArgs = [
    "notarytool",
    "submit",
    target,
    "--key",
    notaryKeyPath,
    "--key-id",
    env.APP_STORE_CONNECT_KEY_ID,
    "--output-format",
    "json",
  ];
  const infoArgs = [
    "notarytool",
    "info",
    "",
    "--key",
    notaryKeyPath,
    "--key-id",
    env.APP_STORE_CONNECT_KEY_ID,
    "--output-format",
    "json",
  ];

  if (env.APP_STORE_CONNECT_ISSUER_ID) {
    submitArgs.push("--issuer", env.APP_STORE_CONNECT_ISSUER_ID);
    infoArgs.push("--issuer", env.APP_STORE_CONNECT_ISSUER_ID);
  }

  process.stdout.write(`Submitting notarization for ${label}...\n`);
  const submitResult = run("xcrun", submitArgs, { quiet: true });
  const submission = parseNotaryJson(label, submitResult.stdout);
  const submissionId = submission.id as string | undefined;

  if (!submissionId) {
    throw new AppdropError(`Notarization failed for ${label}: missing submission id`, 5);
  }

  process.stdout.write(`Notarization ${label} submission id: ${submissionId}\n`);
  if (submission.status && submission.status !== "In Progress") {
    if (submission.status === "Accepted") {
      return;
    }
    throw new AppdropError(`Notarization failed for ${label}: ${submission.status}`, 5);
  }

  infoArgs[2] = submissionId;
  while (Date.now() < deadline) {
    process.stdout.write(`Checking notarization ${label}...\n`);
    const infoResult = run("xcrun", infoArgs, { quiet: true });
    const info = parseNotaryJson(label, infoResult.stdout);
    const status = info.status as string | undefined;

    if (status === "Accepted") {
      return;
    }

    if (status && status !== "In Progress") {
      throw new AppdropError(`Notarization failed for ${label}: ${status}`, 5);
    }

    run("/bin/sleep", [String(Math.max(1, Math.floor(pollMs / 1000)))]);
  }

  throw new AppdropError(`Notarization timed out for ${label}: ${submissionId}`, 5);
}

function parseNotaryJson(label: string, stdout: string) {
  if (!stdout) {
    throw new AppdropError(`Notarization failed for ${label}: empty response`, 5);
  }
  try {
    return JSON.parse(stdout.trim());
  } catch (error) {
    throw new AppdropError(`Notarization failed for ${label}: ${stdout}`, 5);
  }
}

function parseDuration(input: string): number {
  const match = input.trim().match(/^(\d+)([smh])?$/i);
  if (!match) {
    return 0;
  }
  const value = Number(match[1]);
  const unit = (match[2] ?? "s").toLowerCase();
  if (unit === "h") return value * 60 * 60 * 1000;
  if (unit === "m") return value * 60 * 1000;
  return value * 1000;
}

export function generateAppcast(tools: SparkleTools, dmgPath: string, releaseDir: string, sparkleKey: string) {
  const keyPath = path.join(releaseDir, "sparkle_private_key");
  fs.writeFileSync(keyPath, sparkleKey.trim());
  try {
    run(tools.signUpdate, ["-f", keyPath, dmgPath]);
    run(tools.generateAppcast, ["--ed-key-file", keyPath, "-o", path.join(releaseDir, "appcast.xml"), releaseDir]);
  } finally {
    fs.rmSync(keyPath, { force: true });
  }
}

export function ensureDirectory(target: string, message: string) {
  if (!fs.existsSync(target)) {
    throw new AppdropError(message, 1);
  }
}

export function writeNotaryKey(buildDir: string, key: string): string {
  const notaryDir = fs.mkdtempSync(path.join(buildDir, "notary-"));
  const keyPath = path.join(notaryDir, "AuthKey.p8");
  fs.writeFileSync(keyPath, key);
  return keyPath;
}

export function resolveBundleIdentifier(project: ProjectInfo): string | null {
  try {
    const result = run("xcodebuild", [
      "-project",
      project.projectPath,
      "-scheme",
      project.scheme,
      "-configuration",
      "Release",
      "-showBuildSettings",
    ], { quiet: true });
    const match = result.stdout.match(/\bPRODUCT_BUNDLE_IDENTIFIER\b\s*=\s*(.+)/);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

export function prepareEntitlements(
  entitlementsPath: string | null,
  bundleId: string | null,
  outputDir: string,
  label: string
): string | null {
  if (!entitlementsPath) {
    return null;
  }

  if (!bundleId) {
    return entitlementsPath;
  }

  const content = fs.readFileSync(entitlementsPath, "utf8");
  if (!content.includes("PRODUCT_BUNDLE_IDENTIFIER")) {
    return entitlementsPath;
  }

  const replaced = content
    .replace(/\$\(PRODUCT_BUNDLE_IDENTIFIER\)/g, bundleId)
    .replace(/\$\{PRODUCT_BUNDLE_IDENTIFIER\}/g, bundleId);
  const outputPath = path.join(outputDir, `${label}.entitlements`);
  fs.writeFileSync(outputPath, replaced);
  return outputPath;
}
