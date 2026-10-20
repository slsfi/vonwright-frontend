// Restore method/property spies and timers between tests.
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
