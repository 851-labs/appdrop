import { parseArgs, commandHelpText, VALID_COMMANDS } from "./lib/cli";
import { suggest } from "./lib/suggest";
import { Logger } from "./lib/logger";
import { AppdropError, UsageError } from "./lib/errors";
import { style, symbols } from "./lib/color";
import { runRelease } from "./commands/release";
import { runDoctor } from "./commands/doctor";
import { runBuild } from "./commands/build";
import { runDmg } from "./commands/dmg";
import { runNotarize } from "./commands/notarize";
import { runAppcast } from "./commands/appcast";
import { runSetupCi } from "./commands/setup-ci";
import { runPublish } from "./commands/publish";

import { APPDROP_VERSION } from "./lib/version";

let command: string;
let flags: ReturnType<typeof parseArgs>["flags"];
let helpCommand: string | undefined;

try {
  const parsed = parseArgs(process.argv.slice(2));
  command = parsed.command;
  flags = parsed.flags;
  helpCommand = parsed.helpCommand;
} catch (error) {
  handleError(error);
}

if (flags.version) {
  process.stdout.write(`${APPDROP_VERSION}\n`);
  process.exit(0);
}

if (flags.help) {
  if (helpCommand) {
    process.stdout.write(commandHelpText(helpCommand));
  } else {
    process.stdout.write(helpText());
  }
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
          executable: flags.executable,
          output: flags.output,
          dryRun: flags.dryRun,
          noNotarize: flags.noNotarize,
          noDmg: flags.noDmg,
          noSparkle: flags.noSparkle,
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
    case "setup-ci":
      runSetupCi(
        {
          xcodeOnly: flags.xcodeOnly,
          keychainOnly: flags.keychainOnly,
          xcodePath: flags.xcodePath,
          keychainName: flags.keychainName,
          writeGithubEnv: flags.writeGithubEnv,
          force: flags.force,
          installSparkle: flags.installSparkle,
        },
        logger
      );
      break;
    case "publish":
      runPublish(
        {
          tag: flags.publishTag,
          title: flags.publishTitle,
          notes: flags.publishNotes,
          notesFile: flags.publishNotesFile,
          assets: flags.publishAssets,
          draft: flags.publishDraft,
          prerelease: flags.publishPrerelease,
        },
        logger
      );
      break;
    default: {
      const suggestion = suggest(command, VALID_COMMANDS);
      const didYouMean = suggestion ? `\n\nDid you mean: ${style.info(suggestion)}?` : "";
      process.stderr.write(`${style.error("Unknown command:")} ${command}${didYouMean}\n\nRun 'appdrop --help' for usage.\n`);
      process.exit(2);
    }
  }
} catch (error) {
  handleError(error);
}

function helpText() {
  return `appdrop - zero-config macOS release CLI

EXAMPLES:
  appdrop release                  Build, sign, notarize, and package
  appdrop release --dry-run        Preview the release pipeline
  appdrop doctor --fix             Check and fix project issues
  appdrop publish                  Create GitHub release with assets

COMMANDS:
  release      Build, sign, notarize, and package (default)
  build        Build and export the app bundle
  dmg          Create a DMG from an app bundle
  notarize     Notarize a DMG or ZIP with Apple
  appcast      Generate a Sparkle appcast entry
  doctor       Check project configuration
  setup-ci     Configure CI environment
  publish      Create a GitHub release

GLOBAL FLAGS:
  -n, --dry-run          Preview without executing
  --json                 JSON output
  -q, --quiet            Errors only
  -v, --verbose          Verbose output
  --version              Print version
  -h, --help             Show help

Run 'appdrop <command> --help' for command-specific options.
`;
}

function handleError(error: unknown): never {
  if (error instanceof UsageError) {
    process.stderr.write(`${style.error("error:")} ${error.message}\n`);
    if (error.hint) {
      process.stderr.write(`\n${style.hint(error.hint)}\n`);
    }
    process.exit(error.code);
  }
  if (error instanceof AppdropError) {
    process.stderr.write(`${symbols.error} ${style.error(error.message)}\n`);
    process.exit(error.code);
  }
  process.stderr.write(`${symbols.error} ${style.error(error instanceof Error ? error.message : String(error))}\n`);
  process.exit(1);
}
