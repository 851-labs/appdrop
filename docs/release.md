# Release Process

This document describes how to publish a new appdrop release.

## Prerequisites

- Homebrew installed
- `gh` CLI installed and authenticated
- Access to the self-hosted runner (claudl)
- Access to the Homebrew tap (`851-labs/homebrew-tap`)

## 1) Bump Version

Update `appdrop/src/lib/version.ts`:

```
export const APPDROP_VERSION = process.env.APPDROP_VERSION ?? "0.1.31";
```

Commit the version bump.

## 2) Update Changelog

Add release notes to `CHANGELOG.md` under a new version heading. Only include meaningful changes (fixes, features, docs).

## 3) Tag the Release

```
git tag v0.1.31
git push origin v0.1.31
```

Tagging triggers the GitHub Release workflow, which builds `dist/appdrop` and publishes it.

## 4) Verify Release

```
gh run list --workflow Release --limit 5
gh run watch <RUN_ID>
```

Then confirm the assets:

```
gh release view v0.1.31 --json url,assets
```

## 5) Update Homebrew Tap

Update the `appdrop` formula in `851-labs/homebrew-tap`:

```
cd ~/repos/851-labs/homebrew-tap
```

Edit `Formula/appdrop.rb` with the new version and SHA256, then:

```
git add Formula/appdrop.rb
git commit -m "bump appdrop to 0.1.31"
git push
```

## Troubleshooting

### Release job fails

- Ensure the self-hosted runner is online.
- Verify `gh` is installed and authenticated on the runner.

### Homebrew formula mismatch

- Make sure the release asset name matches the formula URL.
- Recompute SHA256 for the release binary.
