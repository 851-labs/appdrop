import fs from "fs";
import path from "path";
import { Logger } from "../lib/logger";
import { findSparkleTools } from "../lib/pipeline";
import { generateAppcast } from "../lib/release";
import { loadEnv } from "../lib/env";
import { UsageError } from "../lib/errors";

export interface AppcastOptions {
  dmgPath?: string;
  output?: string;
  appcastUrl?: string;
  json: boolean;
}

export function runAppcast(options: AppcastOptions, logger: Logger) {
  if (!options.dmgPath) {
    throw new UsageError("Provide --dmg-path");
  }

  const dmgPath = path.resolve(process.cwd(), options.dmgPath);
  if (!fs.existsSync(dmgPath)) {
    throw new UsageError(`DMG not found at ${dmgPath}`);
  }

  const tools = findSparkleTools(process.env.SPARKLE_BIN);
  if (!tools) {
    throw new UsageError("Sparkle tools not found. Set SPARKLE_BIN or install sparkle.");
  }

  const env = loadEnv(["SPARKLE_PRIVATE_KEY"]);
  const outputDir = options.output ? path.resolve(process.cwd(), options.output) : path.dirname(dmgPath);
  fs.mkdirSync(outputDir, { recursive: true });

  generateAppcast(tools, dmgPath, outputDir, env.SPARKLE_PRIVATE_KEY);

  if (options.json) {
    logger.info(JSON.stringify({ appcast: path.join(outputDir, "appcast.xml") }, null, 2));
  } else {
    logger.info(`Appcast: ${path.join(outputDir, "appcast.xml")}`);
  }
}
