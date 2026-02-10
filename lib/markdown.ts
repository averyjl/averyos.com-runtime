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
    return "";
  }
}

/**
 * Converts markdown content to HTML
 */
export function markdownToHtml(markdown: string): string {
  return marked(markdown) as string;
}

/**
 * Reads markdown file and converts it to HTML
 */
export function loadMarkdownAsHtml(contentPath: string): string {
  const markdown = readMarkdownContent(contentPath);
  return markdownToHtml(markdown);
}
