import { defineConfig } from '@rslib/core';

process.env.NO_COLOR = 'true';

export default defineConfig({
  lib: [
    { syntax: 'es2021', dts: true },
    { format: 'cjs', syntax: 'es2021' },
  ],
});
