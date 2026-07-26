// Unit tests for the working-folder helpers (pure, no Node/Obsidian deps).
//
// Bundled by `npm run build:test` (esbuild src/runtime/context.ts ->
// tests/.build/context.mjs), then run with the Node built-in test runner.

import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveWorkingFolder,
  contextFolderInstructions,
  markdownFormattingInstructions,
  buildSystemInstructions
} from "./.build/context.mjs";

test("resolveWorkingFolder returns the vault root when no sub-folder is set", () => {
  assert.equal(resolveWorkingFolder("C:\\Users\\me\\Vault", ""), "C:\\Users\\me\\Vault");
  assert.equal(resolveWorkingFolder("/home/me/Vault", "  "), "/home/me/Vault");
});

test("resolveWorkingFolder strips a trailing separator from the base", () => {
  assert.equal(resolveWorkingFolder("C:\\Users\\me\\Vault\\", ""), "C:\\Users\\me\\Vault");
  assert.equal(resolveWorkingFolder("/home/me/Vault/", ""), "/home/me/Vault");
});

test("resolveWorkingFolder joins a vault-relative sub-folder with the base separator", () => {
  assert.equal(resolveWorkingFolder("C:\\Users\\me\\Vault", "Projects"), "C:\\Users\\me\\Vault\\Projects");
  assert.equal(resolveWorkingFolder("/home/me/Vault", "Projects/sub"), "/home/me/Vault/Projects/sub");
});

test("resolveWorkingFolder normalises mixed separators in the sub-folder", () => {
  assert.equal(
    resolveWorkingFolder("C:\\Users\\me\\Vault", "Projects/sub"),
    "C:\\Users\\me\\Vault\\Projects\\sub"
  );
  assert.equal(resolveWorkingFolder("C:\\Users\\me\\Vault", "/Projects"), "C:\\Users\\me\\Vault\\Projects");
});

test("resolveWorkingFolder uses an absolute sub-folder as-is", () => {
  assert.equal(resolveWorkingFolder("C:\\Users\\me\\Vault", "D:\\Other"), "D:\\Other");
  assert.equal(resolveWorkingFolder("/home/me/Vault", "/etc/notes"), "/etc/notes");
  assert.equal(resolveWorkingFolder("/home/me/Vault", "\\\\server\\share"), "\\\\server\\share");
});

test("resolveWorkingFolder falls back to the sub-folder when base is empty", () => {
  assert.equal(resolveWorkingFolder("", "Projects"), "Projects");
});

test("contextFolderInstructions embeds the folder and is empty when blank", () => {
  assert.equal(contextFolderInstructions(""), "");
  assert.equal(contextFolderInstructions("   "), "");
  const msg = contextFolderInstructions("C:\\Users\\me\\Vault");
  assert.ok(msg.includes("C:\\Users\\me\\Vault"));
  assert.ok(/working folder/i.test(msg));
  assert.ok(/file/i.test(msg));
});

test("contextFolderInstructions tells the agent to degrade gracefully if sandboxed", () => {
  const msg = contextFolderInstructions("/home/me/Vault");
  assert.ok(/sandbox/i.test(msg));
  assert.ok(/don't have filesystem access|filesystem access/i.test(msg));
  assert.ok(/paste|attach/i.test(msg));
});

test("markdownFormattingInstructions mentions the sidebar-specific formatting rules", () => {
  const msg = markdownFormattingInstructions();
  assert.ok(/markdown/i.test(msg));
  assert.ok(/```/.test(msg));
  assert.ok(/table/i.test(msg));
});

test("buildSystemInstructions includes folder + formatting reminder by default", () => {
  const msg = buildSystemInstructions("/home/me/Vault");
  assert.ok(msg.includes("/home/me/Vault"));
  assert.ok(/markdown/i.test(msg));
});

test("buildSystemInstructions omits the formatting reminder when disabled", () => {
  const msg = buildSystemInstructions("/home/me/Vault", { markdownFormattingEnabled: false });
  assert.ok(msg.includes("/home/me/Vault"));
  assert.ok(!/rendered as markdown/i.test(msg));
});

test("buildSystemInstructions appends a trimmed custom prompt last", () => {
  const msg = buildSystemInstructions("/home/me/Vault", { customPrompt: "  Always answer in Chinese.  " });
  assert.ok(msg.trim().endsWith("Always answer in Chinese."));
});

test("buildSystemInstructions works from an empty folder with only a custom prompt", () => {
  const msg = buildSystemInstructions("", {
    markdownFormattingEnabled: false,
    customPrompt: "Be terse."
  });
  assert.equal(msg, "Be terse.");
});
