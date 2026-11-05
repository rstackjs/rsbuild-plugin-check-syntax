import fs from 'node:fs';
import { parse } from 'acorn';
import { browserslistToESVersion } from 'browserslist-to-es-version';
import { generateError } from './generateError.js';
import { generateHtmlScripts } from './generateHtmlScripts.js';
import type {
  AcornParseError,
  CheckSyntaxOptions as BaseCheckSyntaxOptions,
  CheckSyntaxExclude,
  ECMASyntaxError,
  EcmaVersion,
  ParseContext,
  SyntaxErrorKey,
} from './types.js';
import { isExcluded } from './utils.js';

const HTML_REGEX = /\.html$/;
export const JS_REGEX: RegExp = /\.(?:js|mjs|cjs|jsx)$/;

type CheckSyntaxOptions = BaseCheckSyntaxOptions & {
  rootPath?: string;
} & (
    | Required<Pick<BaseCheckSyntaxOptions, 'targets'>>
    | Required<Pick<BaseCheckSyntaxOptions, 'ecmaVersion'>>
  );

export class CheckSyntax {
  errors: ECMASyntaxError[] = [];

  ecmaVersion: EcmaVersion;

  targets?: string[];

  rootPath: string;

  exclude?: CheckSyntaxExclude;

  excludeOutput?: CheckSyntaxExclude;

  excludeErrorMessage?: CheckSyntaxExclude;

  excludeErrorLogs: SyntaxErrorKey[];

  constructor(options: CheckSyntaxOptions) {
    if (!options) {
      throw new Error('[CheckSyntaxRspackPlugin] `options` is required.');
    }

    const { targets, ecmaVersion } = options;
    if (!targets && !ecmaVersion) {
      throw new Error(
        '[CheckSyntaxRspackPlugin] `targets` or `ecmaVersion` option is required',
      );
    }

    this.targets = targets;
    this.ecmaVersion = ecmaVersion || browserslistToESVersion(targets);
    this.exclude = options.exclude;
    this.excludeErrorMessage = options.excludeErrorMessage;
    this.excludeOutput = options.excludeOutput;
    this.rootPath = options.rootPath || '';
    this.excludeErrorLogs = options.excludeErrorLogs || [];
  }

  async check(filepath: string, code?: string, context?: ParseContext) {
    // If the code is provided, no need to read file.
    if (code) {
      return await this.tryParse(filepath, code, context);
    }

    if (HTML_REGEX.test(filepath)) {
      const htmlScripts = await generateHtmlScripts(filepath);
      await Promise.all(
        htmlScripts.map(async (script) => {
          if (!isExcluded(filepath, this.exclude)) {
            await this.tryParse(filepath, script, { sourceType: 'script' });
          }
        }),
      );
    }

    if (JS_REGEX.test(filepath)) {
      const jsScript = await fs.promises.readFile(filepath, 'utf-8');
      await this.tryParse(filepath, jsScript, context);
    }
  }

  async tryParse(filepath: string, code: string, context?: ParseContext) {
    const sourceType = context?.sourceType ?? 'script';
    try {
      parse(code, { ecmaVersion: this.ecmaVersion, sourceType });
    } catch (_: unknown) {
      const err = _ as AcornParseError;

      const error = await generateError({
        err,
        code,
        filepath,
        exclude: this.exclude,
        excludeErrorMessage: this.excludeErrorMessage,
        rootPath: this.rootPath,
      });

      if (error) {
        this.errors.push(error);
      }
    }
  }
}
