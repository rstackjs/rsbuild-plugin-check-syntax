import type { RsbuildPlugin } from '@rsbuild/core';
import { CheckSyntaxRspackPlugin } from './CheckSyntaxPlugin.js';
import type { CheckSyntaxOptions } from './types.js';

export type PluginCheckSyntaxOptions = CheckSyntaxOptions;
export type { ParseContext, SourceType } from './types.js';

export const PLUGIN_CHECK_SYNTAX_NAME = 'rsbuild:check-syntax';

export function pluginCheckSyntax(
  options: PluginCheckSyntaxOptions = {},
): RsbuildPlugin {
  return {
    name: PLUGIN_CHECK_SYNTAX_NAME,

    setup(api) {
      api.modifyBundlerChain(async (chain, { isDev, target, environment }) => {
        if (isDev || target !== 'web') {
          return;
        }

        const { rootPath } = api.context;

        const targets = options.targets ?? environment.browserslist;

        chain
          .plugin(CheckSyntaxRspackPlugin.name)
          .use(CheckSyntaxRspackPlugin, [
            {
              targets,
              rootPath,
              ...(typeof options === 'object' ? options : {}),
            },
          ]);
      });
    },
  };
}

export { CheckSyntax } from './checkSyntax.js';
export { CheckSyntaxRspackPlugin } from './CheckSyntaxPlugin.js';
