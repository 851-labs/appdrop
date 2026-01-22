import { describe, expect, it } from "bun:test";
import fs from "fs";
import os from "os";
import path from "path";

import { prepareEntitlements } from "../src/lib/release";

describe("prepareEntitlements", () => {
  it("replaces PRODUCT_BUNDLE_IDENTIFIER placeholders", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "appdrop-entitlements-"));
    const entitlementsPath = path.join(tempDir, "input.entitlements");
    fs.writeFileSync(
      entitlementsPath,
      "<plist><string>$(PRODUCT_BUNDLE_IDENTIFIER)-spks</string><string>${PRODUCT_BUNDLE_IDENTIFIER}-spki</string></plist>"
    );

    try {
      const outputPath = prepareEntitlements(entitlementsPath, "so.alexandru.char", tempDir, "app");
      const output = fs.readFileSync(outputPath!, "utf8");
      expect(output).toContain("so.alexandru.char-spks");
      expect(output).toContain("so.alexandru.char-spki");
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
