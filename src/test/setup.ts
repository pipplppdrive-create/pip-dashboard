import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Tanpa vitest globals, auto-cleanup RTL tidak terpasang — pasang manual.
afterEach(() => {
  cleanup();
});
