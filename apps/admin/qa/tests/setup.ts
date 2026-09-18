/**
 * Vitest setup file for React Testing Library
 *
 * This file is automatically loaded by Vitest before running tests.
 * It configures the testing environment with:
 * - Extended DOM matchers from @testing-library/jest-dom
 * - Automatic cleanup between tests to prevent state leakage
 */

import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

// Cleanup after each test to reset the DOM and prevent memory leaks
// This ensures components are unmounted and event listeners are removed
afterEach(() => {
  cleanup();
});
