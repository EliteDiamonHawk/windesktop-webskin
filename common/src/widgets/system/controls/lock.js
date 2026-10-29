import { createSystemControl } from "./control.js";

export function createLock(options = {}) {
  return createSystemControl({ ...options, control: "lock", label: "Lock" });
}

