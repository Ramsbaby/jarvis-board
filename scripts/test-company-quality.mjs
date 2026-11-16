import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './test-support.mjs';

const { COMPANY_QUALITY_KEY, readCompanyQuality, saveCompanyQuality } = load('components/office/company-quality.ts');

test('missing and invalid saved quality fall back to balanced', () => {
  for (const value of [null, '', 'true', 'false', 'unknown', 'DETAILED', '{"quality":"detailed"}', 'balanced']) {
    assert.equal(readCompanyQuality(() => ({ getItem: () => value })), 'balanced');
  }
});

test('both explicit choices survive a fresh read using the same storage', () => {
  const values = new Map();
  const storage = () => ({
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  });
  for (const quality of ['detailed', 'balanced']) {
    saveCompanyQuality(quality, storage);
    assert.equal(values.get(COMPANY_QUALITY_KEY), quality);
    assert.equal(readCompanyQuality(storage), quality);
  }
});

test('blocked access to localStorage cannot prevent opening the game', () => {
  const blocked = () => { throw new Error('SecurityError'); };
  assert.equal(readCompanyQuality(blocked), 'balanced');
  assert.doesNotThrow(() => saveCompanyQuality('detailed', blocked));
});

test('read and write failures are contained, including quota errors', () => {
  const unavailable = () => ({
    getItem: () => { throw new Error('SecurityError'); },
    setItem: () => { throw new Error('QuotaExceededError'); },
  });
  assert.equal(readCompanyQuality(unavailable), 'balanced');
  assert.doesNotThrow(() => saveCompanyQuality('balanced', unavailable));
  assert.doesNotThrow(() => saveCompanyQuality('detailed', unavailable));
});

test('server-side access also falls back safely without window', () => {
  assert.equal(readCompanyQuality(), 'balanced');
  assert.doesNotThrow(() => saveCompanyQuality('detailed'));
});
