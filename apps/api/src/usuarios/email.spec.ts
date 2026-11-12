import { normalizeEmail } from './email.js';

describe('normalizeEmail', () => {
  it('trims whitespace and converts email to lowercase', () => {
    expect(normalizeEmail('  Owner@Example.COM  ')).toBe('owner@example.com');
  });
});
