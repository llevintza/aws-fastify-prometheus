// Global test setup file for Jest
// This file runs before all tests and can be used to configure the test environment

// Configure test timeout
jest.setTimeout(10000);

// Setup global test environment
beforeAll(() => {
  // Global setup before all tests
});

afterAll(() => {
  // Global cleanup after all tests
});

// Mock console methods in tests to avoid noise
const originalConsole = global.console;

beforeEach(() => {
  // Reset console before each test if needed
  global.console = originalConsole;
});

export {};