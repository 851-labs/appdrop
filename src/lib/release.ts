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

  const notaryKeyPath = writeNotaryKey(buildDir, env.APP_STORE_CONNECT_PRIVATE_KEY);

  try {
    buildApp(project, derivedData, env.DEVELOPER_ID_APPLICATION);

    const builtApp = path.join(derivedData, "Build/Products", "Release", `${project.name}.app`);
    ensureDirectory(builtApp, "Built app not found");

    fs.rmSync(appPath, { recursive: true, force: true });
    fs.rmSync(dmgPath, { force: true });
    fs.rmSync(appZip, { force: true });
    fs.cpSync(builtApp, appPath, { recursive: true });

    signSparkle(appPath, env.DEVELOPER_ID_APPLICATION, pipeline.sparkleEntitlementsPath);
    signApp(appPath, env.DEVELOPER_ID_APPLICATION, pipeline.entitlementsPath);

    if (pipeline.notarizeApp) {
      run("/usr/bin/ditto", ["-c", "-k", "--keepParent", appPath, appZip]);
      notarize(notaryKeyPath, env, appZip, "app");
      run("xcrun", ["stapler", "staple", appPath]);
      fs.rmSync(appZip, { force: true });
    }

    if (pipeline.createDmg) {
      const dmgDir = path.join(buildDir, "dmg");
      fs.rmSync(dmgDir, { recursive: true, force: true });
      fs.mkdirSync(dmgDir, { recursive: true });
      fs.cpSync(appPath, path.join(dmgDir, `${project.name}.app`), { recursive: true });

      run("hdiutil", [
        "create",
        "-volname",
        project.name,
        "-srcfolder",
        dmgDir,
        "-ov",
        "-format",
        "UDZO",
        dmgPath,
      ]);

      run("codesign", ["--force", "--timestamp", "--sign", env.DEVELOPER_ID_APPLICATION, dmgPath]);

      if (pipeline.notarizeDmg) {
        notarize(notaryKeyPath, env, dmgPath, "dmg");
        run("xcrun", ["stapler", "staple", dmgPath]);
      }

      fs.cpSync(dmgPath, path.join(releaseDir, path.basename(dmgPath)));

      if (pipeline.generateAppcast && pipeline.sparkleTools) {
        generateAppcast(pipeline.sparkleTools, dmgPath, releaseDir, env.SPARKLE_PRIVATE_KEY);
      }
    }
  } finally {
    fs.rmSync(notaryKeyPath, { force: true });
  }
}

function buildApp(project: ProjectInfo, derivedData: string, identity: string) {
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

function signApp(appPath: string, identity: string, entitlementsPath: string | null) {
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

function signSparkle(appPath: string, identity: string, sparkleEntitlementsPath: string | null) {
  if (!sparkleEntitlementsPath) {
    return;
  }

  const sparkleFramework = path.join(appPath, "Contents/Frameworks/Sparkle.framework");
  const sparkleVersion = path.join(sparkleFramework, "Versions/B");
  const updaterApp = path.join(sparkleVersion, "Updater.app");
  const autoupdate = path.join(sparkleVersion, "Autoupdate");
  const downloaderXpc = path.join(sparkleVersion, "XPCServices/Downloader.xpc");
  const installerXpc = path.join(sparkleVersion, "XPCServices/Installer.xpc");

  signIfExists(path.join(updaterApp, "Contents/MacOS/Updater"), identity, sparkleEntitlementsPath);
  signIfExists(autoupdate, identity, sparkleEntitlementsPath);
  signIfExists(path.join(downloaderXpc, "Contents/MacOS/Downloader"), identity, sparkleEntitlementsPath);
  signIfExists(path.join(installerXpc, "Contents/MacOS/Installer"), identity, sparkleEntitlementsPath);
  signIfExists(updaterApp, identity, sparkleEntitlementsPath);
  signIfExists(downloaderXpc, identity, sparkleEntitlementsPath);
  signIfExists(installerXpc, identity, sparkleEntitlementsPath);
  signIfExists(sparkleFramework, identity, null);
}

function signIfExists(target: string, identity: string, entitlementsPath: string | null) {
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

function notarize(notaryKeyPath: string, env: Record<string, string>, target: string, label: string) {
  const args = [
    "notarytool",
    "submit",
    target,
    "--key",
    notaryKeyPath,
    "--key-id",
    env.APP_STORE_CONNECT_KEY_ID,
    "--wait",
    "--output-format",
    "json",
  ];

  if (env.APP_STORE_CONNECT_ISSUER_ID) {
    args.push("--issuer", env.APP_STORE_CONNECT_ISSUER_ID);
  }

  const result = run("xcrun", args, { quiet: true });
  if (!result.stdout) {
    throw new AppdropError(`Notarization failed for ${label}`, 5);
  }

  try {
    const parsed = JSON.parse(result.stdout.trim());
    if (parsed.status && parsed.status !== "Accepted") {
      throw new AppdropError(`Notarization failed for ${label}: ${parsed.status}`, 5);
    }
  } catch (error) {
    throw new AppdropError(`Notarization failed for ${label}: ${result.stdout}`, 5);
  }
}

function generateAppcast(tools: SparkleTools, dmgPath: string, releaseDir: string, sparkleKey: string) {
  const keyPath = path.join(releaseDir, "sparkle_private_key");
  fs.writeFileSync(keyPath, sparkleKey.trim());
  try {
    run(tools.signUpdate, ["-f", keyPath, dmgPath]);
    run(tools.generateAppcast, ["--ed-key-file", keyPath, "-o", path.join(releaseDir, "appcast.xml"), releaseDir]);
  } finally {
    fs.rmSync(keyPath, { force: true });
  }
}

function ensureDirectory(target: string, message: string) {
  if (!fs.existsSync(target)) {
    throw new AppdropError(message, 1);
  }
}

function writeNotaryKey(buildDir: string, key: string): string {
  const notaryDir = fs.mkdtempSync(path.join(buildDir, "notary-"));
  const keyPath = path.join(notaryDir, "AuthKey.p8");
  fs.writeFileSync(keyPath, key);
  return keyPath;
}
