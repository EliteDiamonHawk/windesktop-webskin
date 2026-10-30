import { Widget } from "../../widgets.js";

const REQUIRED_CLICKS = 3;
const CLICK_WINDOW_MS = 3000;
const CONTROL_ENDPOINT = "/api/system/controls";

const joinEndpoint = (endpoint, control) => `${String(endpoint).replace(/\/$/, "")}/${encodeURIComponent(control)}`;

export function createSystemControl({
  control,
  label,
  className = "",
  endpoint = CONTROL_ENDPOINT,
  safety = false,
  fetcher,
  onError,
} = {}) {
  if (!control || !label) throw new TypeError("System controls require control and label");

  const element = document.createElement("button");
  element.type = "button";
  element.textContent = label;
  element.className = [
    "webskin-system-control",
    `webskin-system-control--${control}`,
    className,
  ].filter(Boolean).join(" ");

  const widget = new Widget(element, { type: "system-control" });
  let clickCount = 0;
  let resetTimer;

  const resetClicks = () => {
    if (resetTimer !== undefined) clearTimeout(resetTimer);
    clickCount = 0;
    resetTimer = undefined;
  };

  const startClickWindow = () => {
    if (resetTimer !== undefined) clearTimeout(resetTimer);
    resetTimer = setTimeout(resetClicks, CLICK_WINDOW_MS);
  };

  const activate = async () => {
    if (safety) {
      if (clickCount === 0) startClickWindow();
      clickCount += 1;
      if (clickCount < REQUIRED_CLICKS) return;
      resetClicks();
    }

    try {
      const request = fetcher ?? globalThis.fetch;
      if (typeof request !== "function") throw new TypeError("System controls require fetch");
      const response = await request(joinEndpoint(endpoint, control), { method: "POST" });
      if (!response?.ok) throw new Error(`System control failed: ${response?.status ?? "unknown status"}`);
    } catch (error) {
      onError?.(error);
    }
  };

  element.addEventListener("click", activate);
  widget.addCleanup(() => {
    element.removeEventListener("click", activate);
    if (resetTimer !== undefined) clearTimeout(resetTimer);
  });

  return element;
}

