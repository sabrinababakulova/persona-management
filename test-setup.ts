import { mock } from "bun:test";

/**
 * Neutralizes the `server-only` guard for tests.
 *
 * Several server modules import `server-only` to stop them being pulled into a
 * client bundle. Outside Next.js's bundler that package resolves to a module
 * that throws on import, so the test runner cannot load any router that
 * transitively reaches one. Tests run on the server by definition, so replacing
 * it with an empty module is safe and keeps the production guard intact.
 */
mock.module("server-only", () => ({}));
