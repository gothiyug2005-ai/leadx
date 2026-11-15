/**
 * RFC 4180 CSV. Cells that a spreadsheet would run as a formula (=, +, -, @,
 * tab, carriage return) are prefixed with an apostrophe, so a name or note
 * someone else typed can never execute in Excel or Sheets.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = Array.isArray(value)
    ? value.join("; ")
    : value instanceof Date
      ? value.toISOString()
      : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(","));
  // A byte-order mark makes Excel open UTF-8 (names with accents) correctly.
  return `﻿${lines.join("\r\n")}\r\n`;
}
