import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRsbuild, loadConfig, mergeRsbuildConfig } from '@rsbuild/core';
import { proxyConsole } from '@rstackjs/test-utils';
import { expect, test } from '@rstest/core';
import stripAnsi from 'strip-ansi';
import { pluginCheckSyntax } from '../../src';
import { normalizeToPosixPath } from '../helper';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('should throw error when exist syntax errors', async () => {
  const { logs, restore } = proxyConsole();

  const rsbuild = await createRsbuild({
    cwd: __dirname,
    rsbuildConfig: {
      ...(await loadConfig({ cwd: __dirname })).content,
      plugins: [pluginCheckSyntax()],
    },
  });

  await expect(rsbuild.build()).rejects.toThrowError(
    '[@rsbuild/plugin-check-syntax]',
  );

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
        log.includes('source:') &&
        normalizeToPosixPath(log).includes('src/test.js'),
    ),
  ).toBeTruthy();
  expect(
    logs.find(
      (log) =>
        log.includes('output:') &&
        normalizeToPosixPath(log).includes('/dist/static/js/index'),
    ),
  ).toBeTruthy();
  expect(logs.find((log) => log.includes('reason:'))).toBeTruthy();
  expect(
    logs.find((log) => log.includes('export const printLog = () =>')),
  ).toBeTruthy();
});

test('should check assets with query correctly', async () => {
  const { logs, restore } = proxyConsole();

  const rsbuild = await createRsbuild({
    cwd: __dirname,
    rsbuildConfig: mergeRsbuildConfig(
      (await loadConfig({ cwd: __dirname })).content,
      {
        output: {
          filename: {
            js: '[name].js?v=[contenthash:8]',
            css: '[name].css?v=[contenthash:8]',
          },
        },
        plugins: [pluginCheckSyntax()],
      },
    ),
  });

  await expect(rsbuild.build()).rejects.toThrowError(
    '[@rsbuild/plugin-check-syntax]',
  );

  restore();

  expect(logs.find((log) => log.includes('ERROR 1'))).toBeTruthy();
  expect(
    logs.find(
      (log) =>
        log.includes('source:') &&
        normalizeToPosixPath(log).includes('src/test.js'),
    ),
  ).toBeTruthy();
  expect(
    logs.find(
      (log) =>
        log.includes('output:') &&
        normalizeToPosixPath(log).includes('/dist/static/js/index'),
    ),
  ).toBeTruthy();
  expect(logs.find((log) => log.includes('reason:'))).toBeTruthy();
  expect(
    logs.find((log) => log.includes('export const printLog = () =>')),
  ).toBeTruthy();
});

test('should not throw error when the source file is excluded via RegExp', async () => {
  const rsbuild = await createRsbuild({
    cwd: __dirname,
    rsbuildConfig: {
      ...(await loadConfig({ cwd: __dirname })).content,
      plugins: [
        pluginCheckSyntax({
          exclude: /src\/test/,
        }),
      ],
    },
  });

  await expect(rsbuild.build()).resolves.toBeTruthy();
});

test('should not throw error when the source file is excluded via function', async () => {
  const rsbuild = await createRsbuild({
    cwd: __dirname,
    rsbuildConfig: {
      ...(await loadConfig({ cwd: __dirname })).content,
      plugins: [
        pluginCheckSyntax({
          exclude: (filepath) => /src[\\/]test\.js/.test(filepath),
        }),
      ],
    },
  });

  await expect(rsbuild.build()).resolves.toBeTruthy();
});

test('should not throw error when the source file is excluded via string', async () => {
  const rsbuild = await createRsbuild({
    cwd: __dirname,
    rsbuildConfig: {
      ...(await loadConfig({ cwd: __dirname })).content,
      plugins: [
        pluginCheckSyntax({
          exclude: path.join(__dirname, 'src/test.js'),
        }),
      ],
    },
  });

  await expect(rsbuild.build()).resolves.toBeTruthy();
});

test('should not throw error when the output file is excluded', async () => {
  const rsbuild = await createRsbuild({
    cwd: __dirname,
    rsbuildConfig: {
      ...(await loadConfig({ cwd: __dirname })).content,
      plugins: [
        pluginCheckSyntax({
          excludeOutput: /dist\/static\/js\//,
        }),
      ],
    },
  });

  await expect(rsbuild.build()).resolves.toBeTruthy();
});

test('should not throw error when the error message is excluded', async () => {
  const rsbuild = await createRsbuild({
    cwd: __dirname,
    rsbuildConfig: {
      ...(await loadConfig({ cwd: __dirname })).content,
      plugins: [
        pluginCheckSyntax({
          excludeErrorMessage: /The keyword '(let|const)' is reserved/,
        }),
      ],
    },
  });

  await expect(rsbuild.build()).resolves.toBeTruthy();
});

test('should not throw error when the targets are support es6', async () => {
  const rsbuild = await createRsbuild({
    cwd: __dirname,
    rsbuildConfig: {
      ...(await loadConfig({ cwd: __dirname })).content,
      plugins: [
        pluginCheckSyntax({
          targets: ['chrome >= 60', 'edge >= 15'],
        }),
      ],
    },
  });

  await expect(rsbuild.build()).resolves.toBeTruthy();
});
