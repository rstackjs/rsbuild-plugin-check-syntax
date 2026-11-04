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
        const sourceType = compilation.outputOptions.module
          ? 'module'
          : 'script';

        // not support compilation.emittedAssets in Rspack
        const emittedAssets = compilation
          .getAssets()
          .filter((a) => a.source)
          .map((a) => {
            // remove query from name
            const resourcePath = a.name.split('?')[0];
            const file = resolve(outputPath, resourcePath);
            if (isExcluded(file, this.excludeOutput)) {
              return '';
            }
            return file;
          });

        const files = emittedAssets.filter(
          (assets) => HTML_REGEX.test(assets) || JS_REGEX.test(assets),
        );
        await Promise.all(
          files.map(async (file) => {
            await this.check(file, undefined, { sourceType });
          }),
        );

        printErrors(this.errors, this.ecmaVersion, this.excludeErrorLogs);
      },
    );
  }
}
