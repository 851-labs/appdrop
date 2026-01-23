import path from "path";
import { Logger } from "../lib/logger";
import { findProject } from "../lib/project";
import { detectPipeline } from "../lib/pipeline";
import { loadEnv } from "../lib/env";
import { buildApp, writeExportOptions } from "../lib/release";
import { UsageError } from "../lib/errors";

export interface BuildOptions {
  root: string;
  scheme?: string;
  project?: string;
  output?: string;
  json: boolean;
}

export function runBuild(options: BuildOptions, logger: Logger) {
  const project = findProject(options.root, options.scheme, options.project);
  const pipeline = detectPipeline(project, { outputDir: options.output, sparkleBin: process.env.SPARKLE_BIN });

  if (pipeline.missingEntitlements || pipeline.missingInfoPlist) {
    throw new UsageError("Missing project configuration. Run `appdrop doctor --fix`.");
  }

  const env = loadEnv(["DEVELOPER_ID_APPLICATION"]);

  if (options.json) {
    logger.info(JSON.stringify({ project, pipeline }, null, 2));
  }

  const derivedData = path.join(pipeline.buildDir, "DerivedData");
  const archivePath = path.join(pipeline.buildDir, `${project.name}.xcarchive`);
  const exportDir = path.join(pipeline.buildDir, "Export");
  const exportOptionsPath = writeExportOptions(pipeline.buildDir, env.DEVELOPER_ID_APPLICATION, env.APPDROP_TEAM_ID);

  buildApp(project, derivedData, archivePath, exportDir, exportOptionsPath, env.DEVELOPER_ID_APPLICATION);

  const builtApp = path.join(exportDir, `${project.name}.app`);
  logger.info(`Built app: ${builtApp}`);
}
