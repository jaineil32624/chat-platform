import { webcrypto } from "node:crypto";

// jsdom ships getRandomValues but not SubtleCrypto — borrow Node's implementation.
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
}
