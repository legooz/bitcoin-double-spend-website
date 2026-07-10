import { describe, expect, it } from 'vitest';

import { formatBtc, formatProbability, riskLevel } from './format';

describe('formatProbability', () => {
  it('formats a normal percentage', () => {
    expect(formatProbability(0.1234)).toBe('12.34%');
  });

  it('uses scientific notation for tiny values', () => {
    expect(formatProbability(0.00001)).toMatch(/e/i);
  });

  it('handles zero and negative', () => {
    expect(formatProbability(0)).toBe('0%');
    expect(formatProbability(-1)).toBe('N/A');
  });
});

describe('riskLevel', () => {
  it('flags high risk', () => {
    expect(riskLevel(0.8, 0, false).className).toBe('value-danger');
  });

  it('flags negligible risk', () => {
    expect(riskLevel(0.001, 0, false).className).toBe('value-success');
  });

  it('labels coinbase transactions', () => {
    expect(riskLevel(0, 0, true).label).toMatch(/coinbase/i);
  });
});

describe('formatBtc', () => {
  it('shows eight decimal places', () => {
    expect(formatBtc(0.5)).toBe('0.50000000 BTC');
  });
});
