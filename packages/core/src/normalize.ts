/** Drops a leading byte-order mark and turns CRLF and CR into LF. Nothing else changes. */
export const normalizeText = (text: string): string => text.replace(/^\ufeff/, "").replace(/\r\n?/g, "\n");
