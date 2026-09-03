import { parse } from 'csv-parse/sync';
import { ParsedEmailResult } from '../types';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim().toLowerCase());
}

/** Header cells that identify a column as carrying email addresses. */
const EMAIL_HEADER_REGEX = /^e-?mail(\s*address)?$/i;

/**
 * A first row is treated as a header when none of its cells is a valid email.
 * That keeps `name,email` headers out of the results while still accepting
 * headerless files that start straight into addresses.
 */
function isHeaderRow(row: string[]): boolean {
  return row.every((cell) => !EMAIL_REGEX.test(cell.trim().toLowerCase()));
}

/**
 * Works out which column indexes should be read as email addresses:
 * - if a header row names an email column, use exactly those columns
 * - otherwise treat every column as a candidate
 */
function resolveEmailColumns(header: string[] | null, columnCount: number): Set<number> {
  if (header) {
    const named = header
      .map((cell, index) => (EMAIL_HEADER_REGEX.test(cell.trim()) ? index : -1))
      .filter((index) => index !== -1);

    if (named.length > 0) return new Set(named);
  }

  return new Set(Array.from({ length: columnCount }, (_, index) => index));
}

export function parseEmailsFromCSV(content: string): ParsedEmailResult {
  const allEmails: string[] = [];
  const invalidEmails: string[] = [];

  try {
    // Parse CSV
    const records = parse(content, {
      skip_empty_lines: true,
      trim: true,
      relaxColumnCount: true,
    }) as string[][];

    if (records.length === 0) {
      return { validEmails: [], invalidEmails: [], duplicates: [], totalRows: 0 };
    }

    const header = isHeaderRow(records[0]) ? records[0] : null;
    const dataRows = header ? records.slice(1) : records;
    const totalRows = dataRows.length;

    const columnCount = records.reduce((max, row) => Math.max(max, row.length), 0);
    const emailColumns = resolveEmailColumns(header, columnCount);

    for (const record of dataRows) {
      record.forEach((field, index) => {
        if (typeof field !== 'string' || !field.trim()) return;

        const email = field.trim().toLowerCase();

        if (EMAIL_REGEX.test(email)) {
          allEmails.push(email);
          return;
        }

        // Only report a cell as invalid when it was meant to hold an address:
        // either it lives in an email column, or it looks like an attempt.
        if (emailColumns.has(index) || field.includes('@')) {
          invalidEmails.push(field);
        }
      });
    }

    // Remove duplicates
    const uniqueEmails = [...new Set(allEmails)];
    const duplicates = allEmails.filter((email, index) => allEmails.indexOf(email) !== index);

    return {
      validEmails: uniqueEmails,
      invalidEmails,
      duplicates: [...new Set(duplicates)],
      totalRows,
    };
  } catch (error: any) {
    throw new Error(`Failed to parse CSV: ${error.message}`);
  }
}

export function parseEmailsFromText(content: string): ParsedEmailResult {
  const lines = content.split(/[\r\n]+/);
  const allEmails: string[] = [];
  const invalidEmails: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim().toLowerCase();
    if (!trimmed) continue;

    if (isValidEmail(trimmed)) {
      allEmails.push(trimmed);
    } else if (trimmed.includes('@')) {
      invalidEmails.push(trimmed);
    }
  }

  // Remove duplicates
  const uniqueEmails = [...new Set(allEmails)];
  const duplicates = allEmails.filter((email, index) => allEmails.indexOf(email) !== index);

  return {
    validEmails: uniqueEmails,
    invalidEmails,
    duplicates: [...new Set(duplicates)],
    totalRows: lines.filter(l => l.trim()).length,
  };
}

export function parseEmails(content: string, fileType: 'csv' | 'txt'): ParsedEmailResult {
  if (fileType === 'csv') {
    return parseEmailsFromCSV(content);
  } else {
    return parseEmailsFromText(content);
  }
}
