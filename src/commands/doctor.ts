import fs from "fs";
import path from "path";
import { Logger } from "../lib/logger";
import { detectPipeline, locateEntitlements, locateInfoPlist } from "../lib/pipeline";
import { findProject } from "../lib/project";

export interface DoctorOptions {
  root: string;
  scheme?: string;
  project?: string;
  fix: boolean;
}

const CHAR_ENTITLEMENTS = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.app-sandbox</key>
  <true/>
  <key>com.apple.security.files.user-selected.read-only</key>
  <true/>
  <key>com.apple.security.network.client</key>
  <true/>
</dict>
</plist>
`;

const SPARKLE_ENTITLEMENTS = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.app-sandbox</key>
  <true/>
  <key>com.apple.security.network.client</key>
  <true/>
</dict>
</plist>
`;

export function runDoctor(options: DoctorOptions, logger: Logger) {
  const project = findProject(options.root, options.scheme, options.project);
  const pipeline = detectPipeline(project, { sparkleBin: process.env.SPARKLE_BIN });

  logger.info(`Project: ${project.projectPath}`);

  if (!options.fix) {
    if (pipeline.missingEntitlements) {
      logger.warn("Missing entitlements. Run `appdrop doctor --fix`.");
    }
    if (pipeline.missingInfoPlist) {
      logger.warn("Missing Info.plist.");
    }
    return;
  }

  const resourcesDir = locateResourcesDir(project.root, project.name);
  const charEntitlementsPath = path.join(resourcesDir, `${project.name}.entitlements`);
  const sparkleEntitlementsPath = path.join(resourcesDir, "sparkle.entitlements");

  if (!fs.existsSync(charEntitlementsPath)) {
    fs.writeFileSync(charEntitlementsPath, CHAR_ENTITLEMENTS);
    logger.info(`Created ${charEntitlementsPath}`);
  }

  if (!fs.existsSync(sparkleEntitlementsPath)) {
    fs.writeFileSync(sparkleEntitlementsPath, SPARKLE_ENTITLEMENTS);
    logger.info(`Created ${sparkleEntitlementsPath}`);
  }

  if (!locateInfoPlist(project.root)) {
    logger.warn("No Info.plist detected. Create one and set INFOPLIST_FILE in Xcode.");
  }

  if (!locateEntitlements(project.root, `${project.name}.entitlements`)) {
    logger.warn("Entitlements still missing in project settings. Update CODE_SIGN_ENTITLEMENTS.");
  }
}

function locateResourcesDir(root: string, projectName: string): string {
  const candidates = [
    path.join(root, "Resources"),
    path.join(root, projectName, "Resources"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  fs.mkdirSync(candidates[0], { recursive: true });
  return candidates[0];
}
