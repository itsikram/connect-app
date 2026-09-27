/// <reference types="jest" />

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../src/contexts/SettingsContext', () => ({ useSettings: () => ({ settings: { language: 'en' } }) }));

import { STRINGS, fill, makeFormatters, toLocalDigits } from '../src/screens/recovery/i18n';

/** Every leaf path with its value, e.g. ["sos.tools.breathing.0", "Breathing"]. */
const leaves = (value: unknown, path = ''): Array<[string, unknown]> => {
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => leaves(child, path ? `${path}.${key}` : key));
  }
  return [[path, value]];
};

const placeholders = (text: string) => (text.match(/\{\w+\}/g) || []).sort();

describe('Recovery strings', () => {
  const en = new Map(leaves(STRINGS.en));
  const bn = new Map(leaves(STRINGS.bn));

  it('has exactly the same keys and list lengths in English and Bangla', () => {
    expect([...bn.keys()].sort()).toEqual([...en.keys()].sort());
  });

  it('has no empty strings', () => {
    const empty = [...en, ...bn].filter(([, value]) => typeof value === 'string' && !value.trim()).map(([path]) => path);
    expect(empty).toEqual([]);
  });

  it('uses the same {placeholders} in both languages', () => {
    const mismatched = [...en].filter(([path, value]) => typeof value === 'string' && placeholders(value).join() !== placeholders(String(bn.get(path))).join()).map(([path]) => path);
    expect(mismatched).toEqual([]);
  });

  it('never calls a person an addict', () => {
    const offending = [...en].filter(([, value]) => typeof value === 'string' && /\baddicts?\b/i.test(value)).map(([path]) => path);
    expect(offending).toEqual([]);
  });
});

describe('Recovery formatting', () => {
  it('fills placeholders and leaves unknown ones', () => {
    expect(fill('{n} days, {x}', { n: 3 })).toBe('3 days, {x}');
  });

  it('uses Bangla digits and lakh grouping', () => {
    expect(toLocalDigits('2026', 'bn')).toBe('২০২৬');
    expect(makeFormatters('en').num(1234567)).toBe('12,34,567');
    expect(makeFormatters('bn').money(15000)).toBe('৳১৫,০০০');
    expect(makeFormatters('en').num(-2500)).toBe('-2,500');
  });

  it('formats durations for small labels', () => {
    const { duration } = makeFormatters('en');
    expect(duration(3 * 86400000 + 4 * 3600000)).toBe('3 days 4 hrs');
    expect(duration(90 * 60000)).toBe('1 hrs 30 min');
    expect(duration(-5)).toBe('0 min');
  });
});
