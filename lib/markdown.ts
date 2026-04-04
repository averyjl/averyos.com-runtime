/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
import { marked } from "marked";
import path from "path";

/**
 * Reads and parses markdown content from the /content directory
 */
export async function readMarkdownContent(contentPath: string): Promise<string> {
  const { default: fs } = await import("node:fs");
  const fullPath = path.join(process.cwd(), "content", contentPath);
  
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const fileContent = fs.readFileSync(fullPath, "utf8");
    return fileContent;
  } catch (error) {
    console.error(`Error reading markdown file at ${fullPath}:`, error);
    // Return a visible error message for easier debugging
    return `# Content Not Found\n\nThe markdown file at \`${contentPath}\` could not be loaded.\n\nPlease ensure the file exists and is readable.`;
  }
}

/**
 * Converts markdown content to HTML
 */
export function markdownToHtml(markdown: string): string {
  // Pass async: false to get a guaranteed synchronous string return.
  // marked v5+ returns string | Promise<string> by default; the async: false
  // overload narrows the return to string and prevents "[object Promise]" 500s.
  return marked(markdown, { async: false });
}

/**
 * Reads markdown file and converts it to HTML
 */
export async function loadMarkdownAsHtml(contentPath: string): Promise<string> {
  const markdown = await readMarkdownContent(contentPath);
  return markdownToHtml(markdown);
}
