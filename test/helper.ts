import path from 'node:path';
export { proxyConsole } from '@rstackjs/test-utils';
import upath from 'upath';

export const normalizeToPosixPath = (p: string | undefined) =>
  upath
    .normalizeSafe(path.normalize(p || ''))
    .replace(/^([a-zA-Z]+):/, (_, m: string) => `/${m.toLowerCase()}`);
