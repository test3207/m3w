import { defineConfig } from 'tsup';

/**
 * Shared Package Build Configuration
 * 
 * Uses tsup for bundling while keeping tsconfig.json with composite: true
 * for project references support in backend development.
 * 
 * Why tsup instead of tsc?
 * - tsc with composite + bundler moduleResolution only outputs .d.ts.map files
 * - tsup properly bundles code and generates both .js and .d.ts files
 * - tsconfig.json remains valid for IDE type checking and project references
 * 
 * Why separate tsconfig.build.json for DTS?
 * - tsup's DTS plugin conflicts with composite mode
 * - tsconfig.build.json extends tsconfig.json but disables composite for build
 * - tsconfig.json with composite: true remains for backend project references
 * 
 * Multiple Entry Points:
 * - Enables subpath exports like @m3w/shared/constants
 * - Prevents Zod from being pulled into main bundle when only constants/types are needed
 * - Consumers can import { isOfflineCapable } from "@m3w/shared/api-contracts" without Zod
 */
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    types: 'src/types/index.ts',
    schemas: 'src/schemas.ts',
    'api-contracts': 'src/api-contracts.ts',
    constants: 'src/constants.ts',
    transformers: 'src/transformers.ts',
  },
  format: ['esm'],
  target: 'es2022',
  dts: {
    // Use separate config without composite for DTS generation
    compilerOptions: {
      composite: false,
    },
  },
  clean: true,
  sourcemap: true,
  splitting: false,
  // Mark zod as external to avoid bundling it
  external: ['zod'],
});
