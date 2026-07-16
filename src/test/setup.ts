import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { webcrypto } from 'node:crypto';

// jsdom tidak menyediakan crypto.subtle — pakai webcrypto Node.
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

// Tanpa vitest globals, auto-cleanup RTL tidak terpasang — pasang manual.
afterEach(() => {
  cleanup();
});
