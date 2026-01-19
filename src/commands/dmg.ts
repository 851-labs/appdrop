import fs from "fs";
import path from "path";
import { Logger } from "../lib/logger";
import { findProject } from "../lib/project";
import { detectPipeline } from "../lib/pipeline";
import { loadEnv } from "../lib/env";
import { createDmg } from "../lib/release";
import { UsageError } from "../lib/errors";

export interface DmgOptions {
  root: string;
  scheme?: string;
  project?: string;
  appPath?: string;
  output?: string;
  json: boolean;
}

export function runDmg(options: DmgOptions, logger: Logger) {
  const project = findProject(options.root, options.scheme, options.project);
  const pipeline = detectPipeline(project, { outputDir: options.output, sparkleBin: process.env.SPARKLE_BIN });

  const env = loadEnv(["DEVELOPER_ID_APPLICATION"]);

  const appPath = options.appPath
    ? path.resolve(options.root, options.appPath)
    : path.join(pipeline.buildDir, `${project.name}.app`);

  if (!fs.existsSync(appPath)) {
    throw new UsageError(`App not found at ${appPath}`);
  }

  const dmgPath = path.join(pipeline.buildDir, `${project.name}.dmg`);
  createDmg(appPath, dmgPath, project.name, env.DEVELOPER_ID_APPLICATION);

  if (options.json) {
    logger.info(JSON.stringify({ dmgPath }, null, 2));
  } else {
    logger.info(`DMG: ${dmgPath}`);
  }
}
