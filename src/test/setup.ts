import '@testing-library/jest-dom/vitest';
import { webcrypto } from 'node:crypto';

Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
if (!globalThis.URL.createObjectURL) globalThis.URL.createObjectURL = () => 'blob:test';
if (!globalThis.URL.revokeObjectURL) globalThis.URL.revokeObjectURL = () => undefined;
