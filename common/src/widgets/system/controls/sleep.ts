import { createSystemControl } from "./control.js";

export function createSleep(options = {}) {
  return createSystemControl({ ...options, control: "sleep", label: "Sleep" });
}

