import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rspack } from '@rspack/core';
import { proxyConsole, toPosixPath } from '@rstackjs/test-utils';
import { expect, test } from 'rstack/test';
import stripAnsi from 'strip-ansi';
import { CheckSyntaxRspackPlugin } from '../../dist';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('detects module output from the Rspack config', async () => {
  const { logs, restore } = proxyConsole();
  const compiler = rspack({
    context: __dirname,
    mode: 'production',
    output: { module: true },
    experiments: { outputModule: true },
    plugins: [new CheckSyntaxRspackPlugin({ ecmaVersion: 5 })],
  });

  try {
    await expect(
      new Promise((resolve, reject) => {
        compiler.run((err, stats) => {
          if (err) {
            reject(err);
          } else {
            resolve(stats);
          }
        });
      }),
    ).rejects.toThrowError('[@rsbuild/plugin-check-syntax]');
    expect(
      logs.some((log) =>
        log.includes('Module sourceType requires ecmaVersion >= 2015'),
      ),
    ).toBeTruthy();
  } finally {
    restore();
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
