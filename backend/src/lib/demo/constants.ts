/**
 * Demo Mode Constants - Backend
 * 
 * IS_DEMO_BUILD: Compile-time flag set during build process
 * - true for RC builds (BUILD_TARGET=rc)
 * - false for Prod builds (BUILD_TARGET=prod)
 * 
 * When false, all demo-related code will be tree-shaken (removed) from the bundle.
 */
export const IS_DEMO_BUILD = process.env.BUILD_TARGET === 'rc';
