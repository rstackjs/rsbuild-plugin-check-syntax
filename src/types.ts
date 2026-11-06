import type { ecmaVersion as EcmaVersion } from 'acorn';

export type { EcmaVersion };

export type SourceType = 'script' | 'module';

export interface ParseContext {
  sourceType?: SourceType;
}

export type Condition = string | RegExp | ((filepath: string) => boolean);

export type CheckSyntaxExclude = Condition | Condition[];

export type CheckSyntaxOptions = {
  /**
   * The target browser range of the project.
   * Its value is a standard browserslist array.
   */
  targets?: string[];
  /**
   * Excludes a portion of source files during detection.
   * You can pass in one or more regular expressions to match the paths of source files.
   */
  exclude?: CheckSyntaxExclude;
  /**
   * Excludes files by output path before detection.
   * You can pass in one or more regular expressions to match the paths of source files.
   */
  excludeOutput?: CheckSyntaxExclude;
  /**
   * Excludes specified error messages.
   * You can pass in one or more regular expressions to match the reasons.
   */
  excludeErrorMessage?: RegExp | RegExp[];
  /**
   * Ignores specified syntax error messages after detection.
   * You can pass in one or more error message types to ignore.
   */
  excludeErrorLogs?: SyntaxErrorKey[];
  /**
   * The minimum ECMAScript syntax version that can be used in the build artifact.
   * The priority of `ecmaVersion` is higher than `targets`.
   */
  ecmaVersion?: EcmaVersion;
};

export interface Location {
  line: number;
  column: number;
}

export interface File {
  path: string;
  line: number;
  column: number;
}

type Source = File & { code: string } & { absolutePath: string };

interface SyntaxErrorOptions {
  source: Source;
  output?: File;
}

export class ECMASyntaxError extends Error {
  source: Source;

  output: File | undefined;

  constructor(message: string, options: SyntaxErrorOptions) {
    super(message);
    this.source = options.source;
    this.output = options.output;
  }
}

export type AcornParseError = {
  message: string;
  pos: number;
  loc: Location;
};

export type SyntaxErrorInfo = {
  source: string;
  output?: string;
  reason: string;
  code: string;
};

export type SyntaxErrorKey = keyof SyntaxErrorInfo;
