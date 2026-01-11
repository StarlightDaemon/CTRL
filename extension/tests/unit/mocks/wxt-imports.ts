// Mock implementation of WXT's auto-imports
// Add standard WXT hooks here if components rely on them directly

export const useMounted = () => true;
export const browser = (globalThis as any).browser;
// Add other WXT exports as needed during test failures
