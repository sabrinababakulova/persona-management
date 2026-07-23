declare module "bun:test" {
  interface Matchers {
    toBe(expected: unknown): void;
    toBeInstanceOf(expected: abstract new (...args: never[]) => unknown): void;
    toBeNull(): void;
    toContain(expected: unknown): void;
    toEqual(expected: unknown): void;
    toBeGreaterThan(expected: number): void;
    toHaveLength(expected: number): void;
    toBeLessThanOrEqual(expected: number): void;
    toMatchObject(expected: unknown): void;
    readonly rejects: Matchers;
    readonly resolves: Matchers;
  }

  export function afterEach(fn: () => void | Promise<void>): void;
  export function describe(name: string, fn: () => void): void;
  export function test(name: string, fn: () => void | Promise<void>): void;
  export function expect(actual: unknown): Matchers;
}
