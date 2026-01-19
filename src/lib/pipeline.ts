import fs from "fs";
import fs from "fs";
import path from "path";
import { DEFAULT_BUILD_DIR, DEFAULT_OUTPUT_DIR } from "./constants";
import { ProjectInfo } from "./project";

export interface SparkleTools {
  signUpdate: string;
  generateAppcast: string;
}

export interface Pipeline {
  buildApp: boolean;
  signApp: boolean;
  notarizeApp: boolean;
  createDmg: boolean;
  notarizeDmg: boolean;
  sparkle: boolean;
  generateAppcast: boolean;
  sparkleEnabled: boolean;
  outputDir: string;
  buildDir: string;
  infoPlistPath: string | null;
  entitlementsPath: string | null;
  sparkleEntitlementsPath: string | null;
  sparkleTools: SparkleTools | null;
  missingEntitlements: boolean;
  missingInfoPlist: boolean;
}

export interface DetectionOptions {
  outputDir?: string;
  buildDir?: string;
  sparkleBin?: string;
}

export function detectPipeline(project: ProjectInfo, options: DetectionOptions = {}): Pipeline {
  const outputDir = path.resolve(project.root, options.outputDir ?? DEFAULT_OUTPUT_DIR);
  const buildDir = path.resolve(project.root, options.buildDir ?? DEFAULT_BUILD_DIR);

  const infoPlistPath = locateInfoPlist(project.root);
  let missingInfoPlist = false;

  const entitlementsPath = locateEntitlements(project.root, `${project.name}.entitlements`);
  const sparkleEntitlementsPath = locateEntitlements(project.root, "sparkle.entitlements");

  const sparkleEnabled = infoPlistPath ? hasSparkleKeys(infoPlistPath) : false;
  const sparkleTools = findSparkleTools(options.sparkleBin ?? process.env.SPARKLE_BIN);
  const sparkle = sparkleEnabled && Boolean(sparkleTools);
  missingInfoPlist = sparkleEnabled && !infoPlistPath;

  return {
    buildApp: true,
    signApp: true,
    notarizeApp: true,
    createDmg: true,
    notarizeDmg: true,
    sparkle,
    generateAppcast: sparkle,
    sparkleEnabled,
    outputDir,
    buildDir,
    infoPlistPath,
    entitlementsPath,
    sparkleEntitlementsPath,
    sparkleTools,
    missingEntitlements: !entitlementsPath || (sparkleEnabled && !sparkleEntitlementsPath),
    missingInfoPlist,
  };
}

export function locateInfoPlist(root: string): string | null {
  const candidates = walk(root, (entry) => entry.endsWith("Info.plist"));
  return candidates[0] ?? null;
}

export function hasSparkleKeys(infoPlistPath: string): boolean {
  const content = fs.readFileSync(infoPlistPath, "utf8");
  return content.includes("SUFeedURL") && content.includes("SUPublicEDKey");
}

export function locateEntitlements(root: string, fileName: string): string | null {
  const candidates = walk(root, (entry) => entry.endsWith(fileName));
  return candidates[0] ?? null;
}

export function findSparkleTools(explicitBin?: string): SparkleTools | null {
  const candidates: string[] = [];
  if (explicitBin) {
    candidates.push(explicitBin);
  } else {
    candidates.push(path.join(process.env.HOME ?? "", ".local/bin"));

    for (const base of ["/opt/homebrew/Caskroom/sparkle", "/usr/local/Caskroom/sparkle"]) {
      if (!fs.existsSync(base)) continue;
      const versions = fs.readdirSync(base).sort().reverse();
      for (const version of versions) {
        candidates.push(path.join(base, version, "bin"));
      }
    }
  }

  for (const candidate of candidates) {
    const signUpdate = path.join(candidate, "sign_update");
    const generateAppcast = path.join(candidate, "generate_appcast");
    if (fs.existsSync(signUpdate) && fs.existsSync(generateAppcast)) {
      return { signUpdate, generateAppcast };
    }
  }

  return null;
}

function walk(root: string, predicate: (path: string) => boolean): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(root, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      results.push(...walk(fullPath, predicate));
    } else if (predicate(fullPath)) {
      results.push(fullPath);
    }
  }
  return results;
}
