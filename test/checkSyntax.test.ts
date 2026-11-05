import { expect, test } from 'rstack/test';
import { CheckSyntax } from '../src';

test('module mode preserves Acorn syntax version checks', async () => {
  const checker = new CheckSyntax({ ecmaVersion: 5 });
  await checker.check('module.js', 'export var value = 1;', {
    sourceType: 'module',
  });
  expect(checker.errors).toHaveLength(0);

  await checker.check('module.js', 'export const value = 1;', {
    sourceType: 'module',
  });
  expect(checker.errors).toHaveLength(1);
});

test('per-check mode enforces module strictness without changing the default', async () => {
  const checker = new CheckSyntax({ ecmaVersion: 2020 });
  const code = 'function value(a, a) { return a; }';
  await Promise.all([
    checker.check('script.js', code, { sourceType: 'script' }),
    checker.check('module.js', code, { sourceType: 'module' }),
  ]);
  expect(checker.errors.map((error) => error.source.absolutePath)).toEqual([
    'module.js',
  ]);

  await checker.tryParse('default.js', 'export var value = 1;');
  expect(checker.errors.map((error) => error.source.absolutePath)).toEqual([
    'module.js',
    'default.js',
  ]);
});
