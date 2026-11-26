/** Numbers each recording attempt, so one that has been given up on can no longer change the screen. */
export function createGuard() {
  let current = 0;
  return {
    begin: () => ++current,
    isCurrent: (token: number) => token === current,
    invalidate: () => { current++; },
  };
}
export type Guard = ReturnType<typeof createGuard>;
