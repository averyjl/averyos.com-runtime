import { marked } from "marked";
import fs from "fs";
import path from "path";

/**
 * Reads and parses markdown content from the /content directory
 */
export function readMarkdownContent(contentPath: string): string {
  const fullPath = path.join(process.cwd(), "content", contentPath);
  
  try {
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
export function loadMarkdownAsHtml(contentPath: string): string {
  const markdown = readMarkdownContent(contentPath);
  return markdownToHtml(markdown);
}
