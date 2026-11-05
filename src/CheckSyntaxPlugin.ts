import { resolve } from 'node:path';
import type { Rspack } from '@rsbuild/core';
import { CheckSyntax } from './checkSyntax.js';
import { printErrors } from './printErrors.js';
import { isExcluded } from './utils.js';

type Compiler = Rspack.Compiler;
type Compilation = Rspack.Compilation;

const HTML_REGEX = /\.html$/;
export const JS_REGEX: RegExp = /\.(?:js|mjs|cjs|jsx)$/;

export class CheckSyntaxRspackPlugin extends CheckSyntax {
  apply(compiler: Compiler): void {
    if (compiler.options.context && !this.rootPath) {
      this.rootPath = compiler.options.context;
    }

    compiler.hooks.afterEmit.tapPromise(
      CheckSyntaxRspackPlugin.name,
      async (compilation: Compilation) => {
        const outputPath = compilation.outputOptions.path || 'dist';
        const chunkFiles = new Set(
          [...compilation.chunks].flatMap((chunk) => [...chunk.files]),
        );

        // not support compilation.emittedAssets in Rspack
        const files = compilation
          .getAssets()
          .filter((a) => a.source)
          .map(({ name }) => ({
            name,
            // Remove the query only when resolving the file on disk.
            filepath: resolve(outputPath, name.split('?')[0]),
          }))
          .filter(
            ({ filepath }) =>
              (HTML_REGEX.test(filepath) || JS_REGEX.test(filepath)) &&
              !isExcluded(filepath, this.excludeOutput),
          );
        await Promise.all(
          files.map(async ({ name, filepath }) => {
            await this.check(filepath, undefined, {
              sourceType:
                compilation.outputOptions.module && chunkFiles.has(name)
                  ? 'module'
                  : 'script',
            });
          }),
        );

        printErrors(this.errors, this.ecmaVersion, this.excludeErrorLogs);
      },
    );
  }
}
