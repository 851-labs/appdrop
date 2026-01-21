import { detectPipeline } from "../lib/pipeline";
import { findProject } from "../lib/project";
import { Logger } from "../lib/logger";
import { loadEnv } from "../lib/env";
import { UsageError } from "../lib/errors";
import { runReleasePipeline } from "../lib/release";

export interface ReleaseOptions {
  root: string;
  scheme?: string;
  project?: string;
  output?: string;
  dryRun: boolean;
  noNotarize: boolean;
  noDmg: boolean;
  noSparkle: boolean;
  json: boolean;
}

export function runRelease(options: ReleaseOptions, logger: Logger) {
  const project = findProject(options.root, options.scheme, options.project);
  let pipeline = detectPipeline(project, { outputDir: options.output, sparkleBin: process.env.SPARKLE_BIN });

  if (options.noDmg) {
    pipeline = { ...pipeline, createDmg: false, notarizeDmg: false, generateAppcast: false };
  }

  if (options.noSparkle) {
    pipeline = {
      ...pipeline,
      sparkle: false,
      generateAppcast: false,
      sparkleEnabled: false,
      missingEntitlements: !pipeline.entitlementsPath,
      missingInfoPlist: !pipeline.infoPlistPath,
    };
  }

  if (options.noNotarize) {
    pipeline = { ...pipeline, notarizeApp: false, notarizeDmg: false };
  }

  if (options.json) {
    logger.info(JSON.stringify({ project, pipeline }, null, 2));
  } else {
    logger.info(`Project: ${project.projectPath}`);
    logger.info(`Scheme: ${project.scheme}`);
    logger.info(`Pipeline: build=${pipeline.buildApp} dmg=${pipeline.createDmg} sparkle=${pipeline.sparkle}`);
  }

  if (options.dryRun) {
    return;
  }

  if (pipeline.missingEntitlements || pipeline.missingInfoPlist) {
    throw new UsageError("Missing project configuration. Run `appdrop doctor --fix`.");
  }

  const requiredEnv = ["DEVELOPER_ID_APPLICATION"];
  if (pipeline.notarizeApp || pipeline.notarizeDmg) {
    requiredEnv.push("APP_STORE_CONNECT_KEY_ID", "APP_STORE_CONNECT_PRIVATE_KEY");
  }
  if (pipeline.sparkle) {
    requiredEnv.push("SPARKLE_PRIVATE_KEY");
  }

  const env = loadEnv(requiredEnv);
  if (process.env.APP_STORE_CONNECT_ISSUER_ID) {
    env.APP_STORE_CONNECT_ISSUER_ID = process.env.APP_STORE_CONNECT_ISSUER_ID;
  }

  runReleasePipeline({ project, pipeline, env });
}
