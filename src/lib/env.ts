import { REQUIRED_ENV_VARS } from "./constants";
import { MissingEnvError } from "./errors";

export type Env = Record<string, string>;

export function loadEnv(required: readonly string[] = REQUIRED_ENV_VARS): Env {
  const env: Env = {};
  for (const name of required) {
    const value = process.env[name];
    if (!value) {
      throw new MissingEnvError(`Missing ${name}`);
    }
    env[name] = value;
  }
  return env;
}
