/**
 * Demo Mode Constants - Frontend
 * 
 * IS_DEMO_BUILD: Compile-time flag set during build process
 * - true for RC builds (BUILD_TARGET=rc)
 * - false for Prod builds (BUILD_TARGET=prod)
 * 
 * When false, all demo-related code will be tree-shaken (removed) from the bundle.
 * 
 * Using __VITE_IS_DEMO_BUILD__ ensures proper dead code elimination
 * because it's replaced with a boolean literal during build.
 */

// TypeScript declaration for the Vite-injected global
declare const __VITE_IS_DEMO_BUILD__: boolean;

export const IS_DEMO_BUILD = __VITE_IS_DEMO_BUILD__;
