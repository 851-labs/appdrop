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

  const infoPlistPath = locateInfoPlist(project.root);
  if (!infoPlistPath) {
    const createdInfoPlist = path.join(resourcesDir, "Info.plist");
    fs.writeFileSync(createdInfoPlist, defaultInfoPlist(project.name));
    logger.info(`Created ${createdInfoPlist}`);
  }

  const projectUpdated = updateProjectFile(project.projectPath, {
    entitlementsPath: charEntitlementsPath,
    infoPlistPath: infoPlistPath ?? path.join(resourcesDir, "Info.plist"),
  });

  if (projectUpdated) {
    logger.info("Updated project build settings.");
  }

  if (!locateEntitlements(project.root, `${project.name}.entitlements`)) {
    logger.warn("Entitlements still missing in project settings. Update CODE_SIGN_ENTITLEMENTS.");
  }
}

function defaultInfoPlist(appName: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDisplayName</key>
  <string>${appName}</string>
  <key>CFBundleExecutable</key>
  <string>$(EXECUTABLE_NAME)</string>
  <key>CFBundleIdentifier</key>
  <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
  <key>CFBundleName</key>
  <string>$(PRODUCT_NAME)</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>$(MARKETING_VERSION)</string>
  <key>CFBundleVersion</key>
  <string>$(CURRENT_PROJECT_VERSION)</string>
  <key>LSApplicationCategoryType</key>
  <string>public.app-category.utilities</string>
  <key>LSMinimumSystemVersion</key>
  <string>$(MACOSX_DEPLOYMENT_TARGET)</string>
  <key>NSPrincipalClass</key>
  <string>NSApplication</string>
</dict>
</plist>
`;
}

function updateProjectFile(projectPath: string, paths: { entitlementsPath: string; infoPlistPath: string }): boolean {
  const pbxprojPath = path.join(projectPath, "project.pbxproj");
  if (!fs.existsSync(pbxprojPath)) {
    return false;
  }

  let content = fs.readFileSync(pbxprojPath, "utf8");
  let updated = false;

  const projectDir = path.dirname(projectPath);
  const entitlementsRel = path.relative(projectDir, paths.entitlementsPath).replace(/\\/g, "/");
  const infoRel = path.relative(projectDir, paths.infoPlistPath).replace(/\\/g, "/");

  if (!content.includes("CODE_SIGN_ENTITLEMENTS")) {
    content = injectBuildSetting(content, "CODE_SIGN_ENTITLEMENTS", entitlementsRel);
    updated = true;
  }

  if (!content.includes("INFOPLIST_FILE")) {
    content = injectBuildSetting(content, "INFOPLIST_FILE", infoRel);
    updated = true;
  }

  if (content.includes("GENERATE_INFOPLIST_FILE = YES")) {
    content = content.replaceAll("GENERATE_INFOPLIST_FILE = YES;", "GENERATE_INFOPLIST_FILE = NO;");
    updated = true;
  }

  if (updated) {
    fs.writeFileSync(pbxprojPath, content);
  }

  return updated;
}

function injectBuildSetting(content: string, key: string, value: string): string {
  const pattern = /(INFOPLIST_FILE\s*=\s*[^;]+;)/g;
  if (pattern.test(content)) {
    return content.replace(pattern, `$1\n\t\t\t\t${key} = ${value};`);
  }

  const fallback = /(PRODUCT_BUNDLE_IDENTIFIER\s*=\s*[^;]+;)/g;
  if (fallback.test(content)) {
    return content.replace(fallback, `$1\n\t\t\t\t${key} = ${value};`);
  }

  return content.replace(/\t\t\t\tbuildSettings = \{/g, `\t\t\t\tbuildSettings = {\n\t\t\t\t${key} = ${value};`);
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
