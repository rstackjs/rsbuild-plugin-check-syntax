import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { rspack } from '@rspack/core';
import { proxyConsole, toPosixPath } from '@rstackjs/test-utils';
import { expect, test } from 'rstack/test';
import stripAnsi from 'strip-ansi';
import { CheckSyntaxRspackPlugin } from '../../dist';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('checks module chunks and copied classic scripts in their own modes', async () => {
  const checker = new CheckSyntaxRspackPlugin({ ecmaVersion: 2022 });
  const compiler = rspack({
    context: __dirname,
    entry: './src/test.js',
    mode: 'production',
    output: {
      path: path.join(__dirname, 'dist'),
      module: true,
      library: { type: 'module' },
      filename: 'bundle.js?test=module',
    },
    optimization: { minimize: false },
    plugins: [
      new rspack.CopyRspackPlugin({
        patterns: [
          {
            from: './src/test.js',
            to: 'classic.js',
            transform: () => 'function legacy(a, a) { return a; }',
          },
          {
            from: './src/test.js',
            to: 'invalid.js',
            transform: () => 'await Promise.resolve();',
          },
        ],
      }),
      checker,
    ],
  });

  try {
    await expect(promisify(compiler.run.bind(compiler))()).rejects.toThrowError(
      '[@rsbuild/plugin-check-syntax]',
    );
    expect(checker.errors.map((error) => error.source.absolutePath)).toEqual([
      path.join(__dirname, 'dist/invalid.js'),
    ]);
  } finally {
    await promisify(compiler.close.bind(compiler))();
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
