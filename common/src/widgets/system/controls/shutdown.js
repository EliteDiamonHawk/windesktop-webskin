import { createSystemControl } from "./control.js";

export function createShutdown({ safety = true, ...options } = {}) {
  return createSystemControl({ ...options, control: "shutdown", label: "Shutdown", safety });
}

