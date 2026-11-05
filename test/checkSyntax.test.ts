import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { expect, test } from 'rstack/test';
import { CheckSyntax } from '../src/checkSyntax';
import type { EcmaVersion, SourceType } from '../src/types';

async function errorsFor(
  code: string,
  ecmaVersion: EcmaVersion,
  sourceType?: SourceType,
) {
  const checker = new CheckSyntax({ ecmaVersion });
  await checker.check('bundle.js', code, { sourceType });
  return checker.errors;
}

test('defaults to script and accepts explicit module syntax', async () => {
  expect((await errorsFor('export const value = 1;', 2015)).length).toBe(1);
  expect(
    (await errorsFor('export const value = 1;', 2015, 'module')).length,
  ).toBe(0);
  expect((await errorsFor('var value = 1;', 5)).length).toBe(0);
});

test('module syntax enforces strict mode without import or export', async () => {
  const code = 'function value(a, a) { return a; }';
  expect((await errorsFor(code, 2024, 'script')).length).toBe(0);
  expect((await errorsFor(code, 2024, 'module')).length).toBe(1);
});

test('module syntax still respects ECMAScript feature versions', async () => {
  const cases: [string, EcmaVersion, EcmaVersion][] = [
    ['const value = input?.value;', 2019, 2020],
    ['export const url = import.meta.url;', 2019, 2020],
    ["export * as ns from 'pkg';", 2019, 2020],
    ['await Promise.resolve();', 2021, 2022],
  ];

  for (const [code, unsupported, supported] of cases) {
    expect((await errorsFor(code, unsupported, 'module')).length).toBe(1);
    expect((await errorsFor(code, supported, 'module')).length).toBe(0);
  }

  expect(
    (await errorsFor('await Promise.resolve();', 2024, 'script')).length,
  ).toBe(1);
});

test('module declarations follow Acorn version semantics', async () => {
  for (const ecmaVersion of [3, 5, 6, 2015, 'latest'] as const) {
    for (const code of [
      'var value = 1;',
      'export var value = 1;',
      "import value from 'pkg';",
    ]) {
      expect(await errorsFor(code, ecmaVersion, 'module')).toHaveLength(0);
    }
  }

  expect(await errorsFor('export const value = 1;', 5, 'module')).toHaveLength(
    1,
  );
});

test('per-check context does not change later calls', async () => {
  const checker = new CheckSyntax({ ecmaVersion: 2020 });
  const code = 'export const value = 1;';

  await Promise.all([
    checker.check('script.js', code, { sourceType: 'script' }),
    checker.check('module.js', code, { sourceType: 'module' }),
  ]);
  expect(checker.errors).toHaveLength(1);
  expect(checker.errors[0].source.absolutePath).toBe('script.js');

  await checker.tryParse('another-module.js', code);
  expect(checker.errors).toHaveLength(2);
  expect(checker.errors[1].source.absolutePath).toBe('another-module.js');
});

test('file reads use per-check context while HTML scripts remain classic', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'check-syntax-'));
  const jsFile = join(dir, 'bundle.js');
  const htmlFile = join(dir, 'index.html');

  try {
    await writeFile(jsFile, 'export const value = 1;');
    await writeFile(
      htmlFile,
      '<script>function value(a, a) { return a; }</script>',
    );

    const checker = new CheckSyntax({ ecmaVersion: 2020 });
    await checker.check(jsFile, undefined, { sourceType: 'module' });
    expect(checker.errors).toHaveLength(0);

    await checker.check(htmlFile, undefined, { sourceType: 'module' });
    expect(checker.errors).toHaveLength(0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('module parse errors retain source maps and existing filters', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'check-syntax-'));
  const filepath = join(dir, 'bundle.js');
  const sourceMap = {
    version: 3,
    file: 'bundle.js',
    sources: ['original.js'],
    sourcesContent: ['export const value = input?.value;'],
    names: [],
    mappings: 'AAAA',
  };

  try {
    await writeFile(`${filepath}.map`, JSON.stringify(sourceMap));

    const checker = new CheckSyntax({
      ecmaVersion: 2019,
      rootPath: dir,
    });
    const code = 'export const value = input?.value;';
    await checker.check(filepath, code, { sourceType: 'module' });
    expect(checker.errors).toHaveLength(1);
    expect(checker.errors[0].output?.path).toBe(`${sep}bundle.js`);
    expect(checker.errors[0].source.absolutePath).toBe(
      join(dir, 'original.js'),
    );

    const filtered = new CheckSyntax({
      ecmaVersion: 2019,
      excludeErrorMessage: /Unexpected token/,
    });
    await filtered.check(filepath, code, {
      sourceType: 'module',
    });
    expect(filtered.errors).toHaveLength(0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
