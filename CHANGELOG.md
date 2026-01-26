# Changelog

## 0.1.31 - 2026-01-26
- feat: add did-you-mean suggestions for typos
- feat: add color output with TTY detection (NO_COLOR/FORCE_COLOR support)
- feat: improve error messages with context and hints
- feat: add short flags (-s, -p, -o) for common options
- feat: lead help text with examples

## 0.1.30 - 2026-01-25
- feat: auto-detect Sparkle from project Info.plist in setup-ci

## 0.1.29 - 2026-01-25
- feat: add Swift Package CLI support
- feat: add --executable flag for CLI target override
- feat: auto-detect CLI executables in publish

## 0.1.28 - 2026-01-24
- feat: add help command

## 0.1.27 - 2026-01-22
- fix: archive with Developer ID signing

## 0.1.26 - 2026-01-22
- refactor: drop sparkle entitlements

## 0.1.25 - 2026-01-22
- test: lock archive export args

## 0.1.24 - 2026-01-22
- fix: force Developer ID signing for archive

## 0.1.23 - 2026-01-22
- fix: let Xcode manage signing

## 0.1.22 - 2026-01-22
- fix: build via archive export

## 0.1.21 - 2026-01-22
- fix: use Xcode archive/export signing

## 0.1.20 - 2026-01-22
- fix: stop re-signing Sparkle helpers

## 0.1.19 - 2026-01-22
- fix: avoid sandboxing Sparkle updater

## 0.1.18 - 2026-01-22
- fix: avoid sandboxing Sparkle XPC

## 0.1.17 - 2026-01-22
- test: cover keychain deletion

## 0.1.16 - 2026-01-21
- fix: substitute bundle id in entitlements

## 0.1.15 - 2026-01-21
- chore: warn when Sparkle is blocked

## 0.1.14 - 2026-01-21
- fix: codesign Sparkle tools in setup-ci

## 0.1.13 - 2026-01-21
- fix: clear Sparkle quarantine in setup-ci

## 0.1.12 - 2026-01-21
- feat: add no-sparkle flag

## 0.1.11 - 2026-01-21
- fix: keep login keychain in search list

## 0.1.10 - 2026-01-21
- fix: recreate keychain in CI

## 0.1.9 - 2026-01-21
- fix: skip xcode-select when already set

## 0.1.8 - 2026-01-21
- feat: infer publish assets

## 0.1.7 - 2026-01-21
- feat: add publish command

## 0.1.6 - 2026-01-21
- feat: auto-detect setup-ci behavior

## 0.1.5 - 2026-01-21
- feat: install Sparkle in setup-ci

## 0.1.4 - 2026-01-21
- feat: add setup-ci command

## 0.1.3 - 2026-01-21
- feat: auto-load .env files

## 0.1.2 - 2026-01-20
- feat: poll notarization status

## 0.1.1 - 2026-01-20
- feat: add notarization timeout

## 0.1.0 - 2026-01-20
- docs: add release workflow note
