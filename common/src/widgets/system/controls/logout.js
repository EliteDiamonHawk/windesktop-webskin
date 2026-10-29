import { createSystemControl } from "./control.js";

export function createLogout(options = {}) {
  return createSystemControl({ ...options, control: "logout", label: "Log Out" });
}

