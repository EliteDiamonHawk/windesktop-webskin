import { createSystemControl } from "./control.js";

export function createRestart({ safety = true, ...options } = {}) {
  return createSystemControl({ ...options, control: "restart", label: "Restart", safety });
}

