/**
 * Notion page-link helpers, shared by the Notion widget and the Connectors
 * settings so "paste your page link" behaves identically in both places.
 */

/**
 * Pull the 32-char page id out of a Notion page link (or a raw id).
 *
 * Handles every shape Notion's "Copy link" produces:
 *   https://www.notion.so/Workspace/Page-Title-<32hex>?pvs=4
 *   https://www.notion.so/<32hex>?v=<viewid>&pvs=4
 *   https://notion.so/<8-4-4-4-12 dashed uuid>
 *   a bare 32-hex id, or a dashed uuid
 *
 * The query string and hash are stripped first — real copied links append
 * `?pvs=4` etc., which defeated the old end-anchored match and left the whole
 * URL stored as the "id".
 */
export function extractNotionPageId(input: string): string {
  const clean = input.trim().split(/[?#]/)[0].replace(/\/+$/, '');
  const uuid = clean.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i);
  if (uuid) return uuid[0].replace(/-/g, '');
  // The id is the trailing 32-hex run of a slugged URL; take the last match so a
  // hex-looking word earlier in the slug can't win.
  const hex = clean.match(/[a-f0-9]{32}/gi);
  if (hex) return hex[hex.length - 1];
  return clean;
}

/** Format a 32-char id as a dashed UUID for the Notion REST API. */
export function toNotionUuid(id: string): string {
  const h = id.replace(/-/g, '');
  if (h.length !== 32) return id;
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
