import '@types/jest';

declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveLength(length: number): R;
      toBeDefined(): R;
      toContain(item: any): R;
      toMatch(regexp: RegExp | string): R;
      toBeTruthy(): R;
    }
  }
}
