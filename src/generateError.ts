import fs from 'node:fs';
import path from 'node:path';
import color from 'picocolors';
import { SourceMapConsumer } from 'source-map';
import {
  type AcornParseError,
  type CheckSyntaxExclude,
  ECMASyntaxError,
} from './types.js';
import { isExcluded } from './utils.js';

export function displayCodePointer(code: string, pos: number) {
  const SUB_LEN = 80;
  const start = Math.max(pos - SUB_LEN / 2, 0);
  const subCode = code.slice(start, start + SUB_LEN);
  const arrowPos = pos - start;
  const arrowLine = color.yellow('^'.padStart(arrowPos + 11, ' '));
  return `${subCode}\n${arrowLine}`;
}

export async function generateError({
  err,
  code,
  filepath,
  rootPath,
  exclude,
  excludeErrorMessage,
}: {
  err: AcornParseError;
  code: string;
  filepath: string;
  rootPath: string;
  exclude?: CheckSyntaxExclude;
  excludeErrorMessage?: CheckSyntaxExclude;
}): Promise<ECMASyntaxError | null> {
  const relativeOutputPath = filepath.replace(rootPath, '');
  let error = await tryGenerateErrorFromSourceMap({
    err,
    code,
    rootPath,
    outputFilepath: filepath,
    relativeOutputPath,
  });

  if (!error) {
    error = new ECMASyntaxError(err.message, {
      source: {
        path: relativeOutputPath,
        absolutePath: filepath,
        line: err.loc.line,
        column: err.loc.column,
        code: displayCodePointer(code, err.pos),
      },
    });
  }

  if (isExcluded(error.source.absolutePath, exclude)) {
    return null;
  }

  if (isExcluded(error.message, excludeErrorMessage)) {
    return null;
  }

  return error;
}

export function makeCodeFrame(lines: string[], highlightIndex: number) {
  const startLine = Math.max(highlightIndex - 3, 0);
  const endLine = Math.min(highlightIndex + 4, lines.length - 1);
  const ret: string[] = [];

  for (let i = startLine; i < endLine; i++) {
    if (i === highlightIndex) {
      const lineNumber = `> ${i + 1}`.padStart(6, ' ');
      ret.push(color.yellow(`${lineNumber} | ${lines[i]}`));
    } else {
      const lineNumber = ` ${i + 1}`.padStart(6, ' ');
      ret.push(color.gray(`${lineNumber} | ${lines[i]}`));
    }
  }

  return `\n${ret.join('\n')}`;
}

/**
 * Extract resource path from Rspack's devtoolModuleFilenameTemplate
 * "resource-path" in "webpack://[namespace]/[resource-path]?[loaders]"
 */
function extractResourcePath(
  source: string,
  sourceMapPath: string,
  rootPath: string,
) {
  if (source.startsWith('webpack://')) {
    const match = source.match(
      /^webpack:\/\/(?:(?:[^/]+)\/)?([^?]+)(?:\?.*)?$/,
    );
    if (match?.[1]) {
      const matched = match[1];
      return path.join(rootPath, matched);
    }
  }

  if (path.isAbsolute(source)) {
    return source;
  }

  return path.join(path.dirname(sourceMapPath), source);
}

async function tryGenerateErrorFromSourceMap({
  err,
  code,
  rootPath,
  outputFilepath,
  relativeOutputPath,
}: {
  err: AcornParseError;
  code: string;
  rootPath: string;
  outputFilepath: string;
  relativeOutputPath: string;
}): Promise<ECMASyntaxError | null> {
  const sourceMapPath = `${outputFilepath}.map`;

  if (!fs.existsSync(sourceMapPath)) {
    return null;
  }

  try {
    const sourcemap = await fs.promises.readFile(sourceMapPath, 'utf-8');
    const consumer = await new SourceMapConsumer(sourcemap);
    const mappedPosition = consumer.originalPositionFor({
      line: err.loc.line,
      column: err.loc.column,
    });

    if (!mappedPosition.source) {
      return null;
    }

    const { sources } = consumer;
    const sourceIndex = sources.indexOf(mappedPosition.source);
    const sourceContent: string | null =
      JSON.parse(sourcemap).sourcesContent?.[sourceIndex];
    const absoluteSourcePath = extractResourcePath(
      mappedPosition.source,
      sourceMapPath,
      rootPath,
    );
    const relativeSourcePath = path.relative(rootPath, absoluteSourcePath);

    if (!sourceContent) {
      return new ECMASyntaxError(err.message, {
        source: {
          path: relativeSourcePath,
          absolutePath: absoluteSourcePath,
          line: mappedPosition.line ?? 0,
          column: mappedPosition.column ?? 0,
          code: displayCodePointer(code, err.pos),
        },
        output: {
          path: relativeOutputPath,
          line: err.loc.line,
          column: err.loc.column,
        },
      });
    }

    const rawLines = sourceContent.split(/\r?\n/g);
    const highlightLine = (mappedPosition.line ?? 1) - 1;

    return new ECMASyntaxError(err.message, {
      source: {
        path: relativeSourcePath,
        absolutePath: absoluteSourcePath,
        line: mappedPosition.line ?? 0,
        column: mappedPosition.column ?? 0,
        code: makeCodeFrame(rawLines, highlightLine),
      },
      output: {
        path: relativeOutputPath,
        line: err.loc.line,
        column: err.loc.column,
      },
    });
  } catch {
    return null;
  }
}
