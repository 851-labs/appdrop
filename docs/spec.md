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
- `appdrop setup-ci` — select Xcode + import signing cert for CI

## Release

Tagging the repo (`vX.Y.Z`) triggers a GitHub Release build that uploads a macOS arm64 binary as `appdrop`.

## Global Flags

- `-h, --help`
- `--version`
- `-q, --quiet` (errors only)
- `-v, --verbose`
- `--json`
- `--plain`
- `-n, --dry-run` (print pipeline only)
- `--no-input`
- `--scheme <name>`
- `--project <path>`
- `--output <dir>`
- `--app-path <path>`
- `--dmg-path <path>`
- `--zip-path <path>`
- `--appcast-url <url>`

`setup-ci` flags:
- `--xcode-only`
- `--keychain-only`
- `--xcode-path <path>`
- `--keychain-name <name>`
- `--write-github-env`
- `--install-sparkle`
- `--force`

## Environment Variables

Required:
- `DEVELOPER_ID_APPLICATION`
- `APP_STORE_CONNECT_KEY_ID`
- `APP_STORE_CONNECT_PRIVATE_KEY`
- `SPARKLE_PRIVATE_KEY`

Optional:
- `APP_STORE_CONNECT_ISSUER_ID`
- `DEVELOPER_ID_CERT_P12`
- `DEVELOPER_ID_CERT_PASSWORD`
- `SPARKLE_BIN`
- `XCODE_PATH`
- `APPDROP_VERSION` (build-time override)

appdrop automatically loads a `.env` file in the current working directory (if present).

`setup-ci` uses:
- `DEVELOPER_ID_CERT_P12` (base64 encoded)
- `DEVELOPER_ID_CERT_PASSWORD`
- `XCODE_PATH` (optional)

## Example Usage

CI setup (Xcode + signing keychain):

```
appdrop setup-ci --write-github-env --install-sparkle
```

Only select Xcode:

```
appdrop setup-ci --xcode-only
```

Only create the keychain (no Xcode changes):

```
appdrop setup-ci --keychain-only --keychain-name appdrop-ci
```

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
- `Resources/<app>.entitlements`
- `Resources/sparkle.entitlements`

And updates the Xcode project to reference them.

## Output

- Human summary to stdout.
- Errors to stderr.
- `--json` outputs a structured plan and results.
