import { symbols, style } from "./color";

export type LogLevel = "quiet" | "normal" | "verbose";

export class Logger {
  constructor(private level: LogLevel) {}

  info(message: string) {
    if (this.level !== "quiet") {
      process.stdout.write(`${message}\n`);
    }
  }

  success(message: string) {
    if (this.level !== "quiet") {
      process.stdout.write(`${symbols.success} ${message}\n`);
    }
  }

  warn(message: string) {
    process.stderr.write(`${symbols.warning} ${style.warn(message)}\n`);
  }

  error(message: string) {
    process.stderr.write(`${symbols.error} ${style.error(message)}\n`);
  }

  verbose(message: string) {
    if (this.level === "verbose") {
      process.stdout.write(`${style.hint(message)}\n`);
    }
  }

  step(message: string) {
    if (this.level !== "quiet") {
      process.stdout.write(`${symbols.info} ${message}\n`);
    }
  }
}
