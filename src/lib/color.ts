// ANSI color codes
const codes = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function shouldUseColor(): boolean {
  // Respect NO_COLOR (https://no-color.org/)
  if (process.env.NO_COLOR !== undefined) {
    return false;
  }

  // Respect FORCE_COLOR
  if (process.env.FORCE_COLOR !== undefined) {
    return true;
  }

  // Check if stdout is a TTY
  return process.stdout.isTTY === true;
}

const useColor = shouldUseColor();

function wrap(code: string, text: string): string {
  if (!useColor) return text;
  return `${code}${text}${codes.reset}`;
}

export const color = {
  red: (text: string) => wrap(codes.red, text),
  green: (text: string) => wrap(codes.green, text),
  yellow: (text: string) => wrap(codes.yellow, text),
  blue: (text: string) => wrap(codes.blue, text),
  cyan: (text: string) => wrap(codes.cyan, text),
  dim: (text: string) => wrap(codes.dim, text),
  bold: (text: string) => wrap(codes.bold, text),
};

// Semantic helpers
export const style = {
  success: (text: string) => color.green(text),
  error: (text: string) => color.red(text),
  warn: (text: string) => color.yellow(text),
  info: (text: string) => color.cyan(text),
  hint: (text: string) => color.dim(text),
};

// Symbols
export const symbols = {
  success: useColor ? color.green("✓") : "✓",
  error: useColor ? color.red("✗") : "✗",
  warning: useColor ? color.yellow("!") : "!",
  info: useColor ? color.cyan("→") : "→",
};
