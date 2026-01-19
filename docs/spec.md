# appdrop CLI Spec

## Purpose

appdrop builds, signs, notarizes, and packages macOS apps with optional Sparkle appcast generation. It is convention-first and auto-detects project settings where possible.

## Commands

- `appdrop release` — full pipeline (build → sign → notarize → dmg → appcast)
- `appdrop build` — build + sign app bundle
- `appdrop dmg` — create + sign DMG from an existing app bundle
- `appdrop notarize` — notarize a zip or dmg
- `appdrop appcast` — generate appcast for a DMG
- `appdrop doctor` — validate environment
- `appdrop doctor --fix` — generate entitlements + patch project files

## Global Flags

- `-h, --help`
- `--version`
- `-q, --quiet` (errors only)
- `-v, --verbose`
- `--json`
- `--plain`
- `-n, --dry-run` (print pipeline only)
- `--no-input`

## Environment Variables

Required:
- `DEVELOPER_ID_APPLICATION`
- `APP_STORE_CONNECT_KEY_ID`
- `APP_STORE_CONNECT_PRIVATE_KEY`
- `SPARKLE_PRIVATE_KEY`

Optional:
- `APP_STORE_CONNECT_ISSUER_ID`
- `SPARKLE_BIN`
- `XCODE_PATH`

## Auto-detect behavior

- Locate the first `.xcodeproj` in the repo unless `--project` is passed.
- Use the first detected scheme unless `--scheme` is passed.
- Sparkle is enabled only if:
  - `SUPublicEDKey` exists in Info.plist (or build settings), and
  - Sparkle tools are available.
- If entitlements are missing, `release` fails and suggests `doctor --fix`.
- `release --dry-run` prints the pipeline and exits.

## Entitlements

`doctor --fix` creates:
- `Resources/char.entitlements`
- `Resources/sparkle.entitlements`

And updates the Xcode project to reference them.

## Output

- Human summary to stdout.
- Errors to stderr.
- `--json` outputs a structured plan and results.
