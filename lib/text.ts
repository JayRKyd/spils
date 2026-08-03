// Strip markdown formatting from AI responses so they render as clean plain text
export function stripMarkdown(t: string): string {
  return t
    .replace(/^#{1,6}\s*/gm, "")            // # headers
    .replace(/\*\*\*(.+?)\*\*\*/g, "$1")    // ***bold italic***
    .replace(/\*\*(.+?)\*\*/g, "$1")        // **bold**
    .replace(/\*(.+?)\*/g, "$1")            // *italic*
    .replace(/__(.+?)__/g, "$1")            // __bold__
    .replace(/`{1,3}([^`]*)`{1,3}/g, "$1")  // `code`
    .replace(/^\s*[-*+]\s+/gm, "• ")        // - bullets → • dots
    .replace(/\n{3,}/g, "\n\n")             // collapse extra blank lines
    .trim();
}
