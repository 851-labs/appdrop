import path from "path";
import { Logger } from "../lib/logger";
import { findProject } from "../lib/project";
import { detectPipeline } from "../lib/pipeline";
import { loadEnv } from "../lib/env";
import { buildApp, signApp, signSparkle } from "../lib/release";
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
  buildApp(project, derivedData, env.DEVELOPER_ID_APPLICATION);

  const builtApp = path.join(derivedData, "Build/Products", "Release", `${project.name}.app`);
  signSparkle(builtApp, env.DEVELOPER_ID_APPLICATION, pipeline.sparkleEntitlementsPath);
  signApp(builtApp, env.DEVELOPER_ID_APPLICATION, pipeline.entitlementsPath);

  logger.info(`Built app: ${builtApp}`);
}
