// Build the prompt sent to Hermes from the user's text plus optional note
// context. Mirrors Claudian's idea of serializing context as simple XML-ish
// tags appended to the prompt, kept deliberately small and readable.

export interface NoteContext {
  notePath?: string;
  selection?: string;
  noteContent?: string;
}

export function buildPrompt(userText: string, ctx: NoteContext): string {
  const parts: string[] = [userText.trim()];

  if (ctx.selection && ctx.selection.trim()) {
    parts.push(
      [
        "<editor_selection>",
        `<file_path>${ctx.notePath ?? ""}</file_path>`,
        "<selection>",
        ctx.selection,
        "</selection>",
        "</editor_selection>"
      ].join("\n")
    );
  }

  if (ctx.noteContent && ctx.noteContent.trim()) {
    parts.push(
      [
        "<current_note>",
        `<file_path>${ctx.notePath ?? ""}</file_path>`,
        "<content>",
        ctx.noteContent,
        "</content>",
        "</current_note>"
      ].join("\n")
    );
  } else if (ctx.notePath) {
    parts.push(`<current_note>${ctx.notePath}</current_note>`);
  }

  return parts.filter(Boolean).join("\n\n");
}

// ---- agent working folder -------------------------------------------------
//
// Hermes does not take a `cwd` field on /v1/runs. Like Hermes Desktop, we tell
// the agent its workspace through the `instructions` system message. The folder
// is the Obsidian vault root by default, or a configured sub-folder/absolute
// path, so the vault becomes the agent's working directory.

/**
 * True when `p` is an absolute path. A Windows drive (`C:\`) or UNC (`\\srv`)
 * is always absolute; a bare leading slash is absolute only on POSIX (inferred
 * from the vault base style) so that a Windows user typing "/Projects" or
 * "\Projects" gets a vault sub-folder, not a drive-root path.
 */
function isAbsolutePath(p: string, base: string): boolean {
  if (/^[a-zA-Z]:[\\/]/.test(p)) return true; // Windows drive
  if (/^\\\\/.test(p)) return true; // UNC
  if (/^\//.test(p)) return !base.includes("\\"); // POSIX absolute
  return false;
}

/**
 * Resolve the agent's working folder.
 * @param vaultBase  absolute path of the Obsidian vault root
 * @param configured the user's "working folder" setting (vault-relative, or
 *                   absolute, or empty for the vault root)
 */
export function resolveWorkingFolder(vaultBase: string, configured: string): string {
  const base = (vaultBase || "").replace(/[\\/]+$/, "");
  const sub = (configured || "").trim();
  if (!sub) return base;
  if (isAbsolutePath(sub, base)) return sub.replace(/[\\/]+$/, "");
  if (!base) return sub;
  const sep = base.includes("\\") ? "\\" : "/";
  return `${base}${sep}${sub.replace(/^[\\/]+/, "").replace(/[\\/]+/g, sep)}`;
}

/**
 * Build the `instructions` system message that scopes the agent to a folder.
 * Mirrors Hermes Desktop's contextFolderSystemMessage(). Because the gateway's
 * Codex sandbox is rooted at the gateway's own launch directory (not the vault)
 * and defaults to read-only, file/dir access under this folder may be denied in
 * some setups — so we tell the agent to fail fast and offer the working
 * alternative instead of looping on rejected permission requests. Returns ""
 * when no folder is known.
 */
export function contextFolderInstructions(folder: string): string {
  const f = (folder || "").trim();
  if (!f) return "";
  return (
    `The working folder for this conversation is ${f}. ` +
    `This folder is an Obsidian vault and is your current working directory: when ` +
    `the user refers to "the current directory", "this folder", or "my notes", they ` +
    `mean ${f} — not your process's own directory. When asked to read, create, ` +
    `modify, search, or summarise notes, prefer the file read/write/search tools ` +
    `with absolute paths under this folder over shell commands. ` +
    `If a file or directory operation is blocked by a restricted sandbox, do NOT ` +
    `retry it repeatedly — state plainly that you don't have filesystem access to ` +
    `the vault in this environment, and offer to work from note content the user ` +
    `pastes or attaches with the "current note" / "selection" toggles instead.`
  );
}

/**
 * Reminds the model that its replies render through Obsidian's own Markdown
 * renderer inside a narrow chat bubble — not a generic chat window. Without
 * this, replies tend to drift into loosely-formatted prose (unlabeled code,
 * inconsistent heading levels, ASCII tables) that the renderer can't clean
 * up after the fact. Always included, independent of the working-folder
 * instructions (which are folder-specific and can be empty).
 */
export function markdownFormattingInstructions(): string {
  return (
    `Your replies are rendered as Markdown inside a narrow Obsidian sidebar panel, ` +
    `so formatting choices matter. Follow standard Markdown conventions: fence code ` +
    `with triple backticks and a language tag (\`\`\`ts, \`\`\`bash, ...), use "-" for ` +
    `bullet lists and "1." for ordered lists with a blank line before/after, use real ` +
    `Markdown tables (header row + "---" separator row) instead of hand-aligned ASCII ` +
    `tables, wrap inline code/identifiers/paths in single backticks, and keep headings ` +
    `to "##" or lower (the panel is narrow — an "#" heading is oversized). Prefer short ` +
    `paragraphs and lists over long blocks of prose. Don't wrap the entire reply in a ` +
    `code fence — only actual code/config/output goes in a fence.`
  );
}

export interface SystemInstructionOptions {
  /** Include the built-in Markdown-formatting reminder. Default true. */
  markdownFormattingEnabled?: boolean;
  /** User-authored text appended after the built-in instructions. */
  customPrompt?: string;
}

/**
 * Combines the working-folder instructions (may be empty), the optional
 * built-in Markdown-formatting reminder, and the user's own custom system
 * prompt (Settings → System prompt) into the single `instructions`/system
 * message sent to the gateway. Order matters a little: folder/workspace
 * facts first, then house-keeping formatting rules, then whatever the user
 * wants to say last (so it reads as the most specific/overriding voice).
 */
export function buildSystemInstructions(folder: string, opts: SystemInstructionOptions = {}): string {
  const parts = [contextFolderInstructions(folder)];
  if (opts.markdownFormattingEnabled !== false) parts.push(markdownFormattingInstructions());
  const custom = (opts.customPrompt || "").trim();
  if (custom) parts.push(custom);
  return parts.filter(Boolean).join("\n\n");
}
