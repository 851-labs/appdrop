import { parseArgs } from "./lib/cli";
import { Logger } from "./lib/logger";
import { AppdropError } from "./lib/errors";
import { runRelease } from "./commands/release";
import { runDoctor } from "./commands/doctor";
import { runBuild } from "./commands/build";
import { runDmg } from "./commands/dmg";
import { runNotarize } from "./commands/notarize";
import { runAppcast } from "./commands/appcast";

const VERSION = "0.1.0";

const { command, flags } = parseArgs(process.argv.slice(2));

if (flags.version) {
  process.stdout.write(`${VERSION}\n`);
  process.exit(0);
}

if (flags.help) {
  process.stdout.write(helpText());
  process.exit(0);
}

const logger = new Logger(flags.quiet ? "quiet" : flags.verbose ? "verbose" : "normal");

try {
  switch (command) {
    case "release":
      runRelease(
        {
          root: process.cwd(),
          scheme: flags.scheme,
          project: flags.project,
          output: flags.output,
          dryRun: flags.dryRun,
          noNotarize: flags.noNotarize,
          noDmg: flags.noDmg,
          json: flags.json,
        },
        logger
      );
      break;
    case "doctor":
      runDoctor(
        {
          root: process.cwd(),
          scheme: flags.scheme,
          project: flags.project,
          fix: flags.fix,
        },
        logger
      );
      break;
    case "build":
      runBuild(
        {
          root: process.cwd(),
          scheme: flags.scheme,
          project: flags.project,
          output: flags.output,
          json: flags.json,
        },
        logger
      );
      break;
    case "dmg":
      runDmg(
        {
          root: process.cwd(),
          scheme: flags.scheme,
          project: flags.project,
          appPath: flags.appPath,
          output: flags.output,
          json: flags.json,
        },
        logger
      );
      break;
    case "notarize":
      runNotarize(
        {
          targetPath: flags.zipPath ?? flags.dmgPath,
          json: flags.json,
        },
        logger
      );
      break;
    case "appcast":
      runAppcast(
        {
          dmgPath: flags.dmgPath,
          output: flags.output,
          appcastUrl: flags.appcastUrl,
          json: flags.json,
        },
        logger
      );
      break;
    default:
      logger.warn(`Unknown command: ${command}`);
      process.exit(2);
  }
} catch (error) {
  if (error instanceof AppdropError) {
    logger.warn(error.message);
    process.exit(error.code);
  }
  logger.warn(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function helpText() {
  return `appdrop - zero-config macOS release CLI\n\nUSAGE:\n  appdrop release [--dry-run]\n  appdrop build\n  appdrop dmg --app-path <path>\n  appdrop notarize --zip-path <path> | --dmg-path <path>\n  appdrop appcast --dmg-path <path>\n  appdrop doctor [--fix]\n\nFLAGS:\n  --scheme <name>     Override scheme\n  --project <path>    Override xcodeproj\n  --output <dir>      Output directory\n  --app-path <path>   Path to .app bundle\n  --dmg-path <path>   Path to .dmg\n  --zip-path <path>   Path to .zip\n  --appcast-url <url> Override appcast URL\n  -n, --dry-run       Print pipeline only\n  --fix               Apply project fixes (doctor)\n  --json              JSON output\n  -q, --quiet         Errors only\n  -v, --verbose       Verbose output\n  --version           Print version\n  -h, --help          Show help\n`;
}
