import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rspack, type Stats } from '@rspack/core';
import { proxyConsole, toPosixPath } from '@rstackjs/test-utils';
import { expect, test } from 'rstack/test';
import stripAnsi from 'strip-ansi';
import { CheckSyntaxRspackPlugin } from '../../dist';

const __dirname = dirname(fileURLToPath(import.meta.url));

for (const [name, code, valid] of [
  ['duplicate parameters', 'function legacy(a, a) { return a; }', true],
  ['top-level await', 'await Promise.resolve();', false],
] as const) {
  test(`checks copied JavaScript with ${name} as script in a module build`, async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'check-syntax-copy-'));
    const copiedFile = path.join(dir, 'legacy.js');
    await writeFile(copiedFile, code);
    const checker = new CheckSyntaxRspackPlugin({ ecmaVersion: 2022 });
    const compiler = rspack({
      context: __dirname,
      entry: './src/test.js',
      mode: 'production',
      output: {
        path: path.join(dir, 'dist'),
        filename: 'bundle.js?test=module',
        module: true,
        library: { type: 'module' },
      },
      optimization: { minimize: false },
      plugins: [
        new rspack.CopyRspackPlugin({
          patterns: [{ from: copiedFile, to: 'legacy.js' }],
        }),
        checker,
      ],
    });

    try {
      const build = new Promise<Stats | undefined>((resolve, reject) => {
        compiler.run((err, stats) => {
          if (err) {
            reject(err);
          } else {
            resolve(stats);
          }
        });
      });
      if (valid) {
        expect((await build)?.hasErrors()).toBe(false);
        expect(checker.errors).toHaveLength(0);
      } else {
        await expect(build).rejects.toThrowError(
          '[@rsbuild/plugin-check-syntax]',
        );
        expect(checker.errors).toHaveLength(1);
        expect(checker.errors[0].source.absolutePath).toBe(
          path.join(dir, 'dist/legacy.js'),
        );
      }
    } finally {
      await new Promise<void>((resolve) => compiler.close(() => resolve()));
      await rm(dir, { recursive: true, force: true });
    }
  });
}

test('detects module output from the Rspack config', async () => {
  const compiler = rspack({
    context: __dirname,
    entry: './src/test.js',
    mode: 'production',
    output: { module: true, library: { type: 'module' } },
    experiments: { outputModule: true },
    plugins: [new CheckSyntaxRspackPlugin({ ecmaVersion: 2015 })],
  });

  try {
    const stats = await new Promise<Stats | undefined>((resolve, reject) => {
      compiler.run((err, stats) => {
        if (err) {
          reject(err);
        } else {
          resolve(stats);
        }
      });
    });
    expect(stats?.hasErrors()).toBe(false);
  } finally {
    await new Promise<void>((resolve) => compiler.close(() => resolve()));
  }
});

test('should throw error when exist syntax errors', async () => {
  const { logs, restore } = proxyConsole();

  const compiler = rspack({
    context: __dirname,
    target: ['web', 'es5'],
    mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    devtool: 'source-map',
    plugins: [
      new CheckSyntaxRspackPlugin({
        ecmaVersion: 5,
      }),
    ],
  });

  await expect(
    new Promise((resolve, reject) => {
      compiler.run((err, stats) => {
        if (err) {
          reject(err);
          return;
        }
        compiler.close(() => {
          resolve(stats);
        });
      });
    }),
  ).rejects.toThrowError('[@rsbuild/plugin-check-syntax]');

  restore();

  expect(
    logs.find((log) =>
      stripAnsi(log).includes(
        'Find some syntax that does not match "ecmaVersion <= 5"',
      ),
    ),
  ).toBeTruthy();

  expect(logs.find((log) => log.includes('ERROR 1'))).toBeTruthy();
  expect(
    logs.find(
      (log) =>
        log.includes('source:') && toPosixPath(log).includes('src/test.js'),
    ),
  ).toBeTruthy();
  expect(
    logs.find(
      (log) =>
        log.includes('output:') && toPosixPath(log).includes('/dist/main'),
    ),
  ).toBeTruthy();
  expect(logs.find((log) => log.includes('reason:'))).toBeTruthy();
  expect(
    logs.find((log) => log.includes('export const printLog = () =>')),
  ).toBeTruthy();
});
