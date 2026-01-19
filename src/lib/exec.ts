import { AppdropError } from "./errors";

export interface RunOptions {
  cwd?: string;
  quiet?: boolean;
  env?: Record<string, string>;
}

export interface RunResult {
  stdout: string;
  stderr: string;
}

export function run(command: string, args: string[], options: RunOptions = {}): RunResult {
  const result = Bun.spawnSync({
    cmd: [command, ...args],
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
  });

  const stdout = result.stdout ? new TextDecoder().decode(result.stdout) : "";
  const stderr = result.stderr ? new TextDecoder().decode(result.stderr) : "";

  if (!options.quiet) {
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
  }

  if (result.exitCode !== 0) {
    throw new AppdropError(`Command failed: ${command}`, 1);
  }

  return { stdout, stderr };
}
