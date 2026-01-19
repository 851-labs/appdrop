import fs from "fs";
import path from "path";
import { Logger } from "../lib/logger";
import { loadEnv } from "../lib/env";
import { notarizeArtifact } from "../lib/release";
import { UsageError } from "../lib/errors";

export interface NotarizeOptions {
  targetPath?: string;
  json: boolean;
}

export function runNotarize(options: NotarizeOptions, logger: Logger) {
  if (!options.targetPath) {
    throw new UsageError("Provide --zip-path or --dmg-path");
  }

  const env = loadEnv([
    "APP_STORE_CONNECT_KEY_ID",
    "APP_STORE_CONNECT_PRIVATE_KEY",
  ]);

  if (process.env.APP_STORE_CONNECT_ISSUER_ID) {
    env.APP_STORE_CONNECT_ISSUER_ID = process.env.APP_STORE_CONNECT_ISSUER_ID;
  }

  const notaryRoot = fs.mkdtempSync(path.join("/tmp", "appdrop-notary-"));
  const notaryKeyPath = path.join(notaryRoot, "AuthKey.p8");
  fs.writeFileSync(notaryKeyPath, env.APP_STORE_CONNECT_PRIVATE_KEY);

  try {
    notarizeArtifact(notaryKeyPath, env, options.targetPath, "artifact");
  } finally {
    fs.rmSync(notaryRoot, { recursive: true, force: true });
  }

  if (options.json) {
    logger.info(JSON.stringify({ target: options.targetPath }, null, 2));
  } else {
    logger.info(`Notarized ${options.targetPath}`);
  }
}
