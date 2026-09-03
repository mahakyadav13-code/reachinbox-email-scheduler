import { describe, it, expect } from 'vitest';
import { isValidEmail, parseEmailsFromCSV, parseEmailsFromText } from '../email-parser';

describe('email-parser', () => {
  describe('isValidEmail', () => {
    it('should validate correct email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(isValidEmail('user+tag@example.com')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('invalid@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('invalid @example.com')).toBe(false);
    });
  });

  describe('parseEmailsFromCSV', () => {
    it('should parse valid emails from CSV', () => {
      const csv = 'name,email\nJohn,john@example.com\nJane,jane@example.com';
      const result = parseEmailsFromCSV(csv);

      expect(result.validEmails).toContain('john@example.com');
      expect(result.validEmails).toContain('jane@example.com');
      expect(result.validEmails).toHaveLength(2);
      expect(result.invalidEmails).toHaveLength(0);
    });

    it('should filter out invalid emails', () => {
      const csv = 'email\nvalid@example.com\ninvalid-email\ntest@domain.com';
      const result = parseEmailsFromCSV(csv);

      expect(result.validEmails).toHaveLength(2);
      expect(result.invalidEmails).toContain('invalid-email');
    });

    it('should remove duplicates', () => {
      const csv = 'test@example.com\ntest@example.com\nother@example.com';
      const result = parseEmailsFromCSV(csv);

      expect(result.validEmails).toHaveLength(2);
      expect(result.duplicates).toContain('test@example.com');
    });
  });

  describe('parseEmailsFromText', () => {
    it('should parse emails from newline-separated text', () => {
      const text = 'john@example.com\njane@example.com\nbob@example.com';
      const result = parseEmailsFromText(text);

      expect(result.validEmails).toHaveLength(3);
      expect(result.validEmails).toContain('john@example.com');
    });

    it('should handle empty lines', () => {
      const text = 'john@example.com\n\njane@example.com\n\n';
      const result = parseEmailsFromText(text);

      expect(result.validEmails).toHaveLength(2);
    });

    it('should remove duplicates', () => {
      const text = 'test@example.com\ntest@example.com\nother@example.com';
      const result = parseEmailsFromText(text);

      expect(result.validEmails).toHaveLength(2);
      expect(result.duplicates).toHaveLength(1);
    });
  });
});
