import { Widget } from "../../widgets.js";
import { subscribeClock, validateUpdateInterval } from "../../time/time-scheduler.js";
import { createPart, fieldsForFormat, renderTokenFormat, resolveFormat, systemMetricsManager } from "./client.js";
import { formatInteger, formatText } from "./formatters.js";

const DEFAULT_FORMAT = "{boot-time}";
const DEFAULT_UPDATE_INTERVAL = 60;
const TOKENS = ["boot-time", "uptime"];
const TOKEN_FIELDS = {
  "boot-time": "system.boot_time",
  uptime: "system.boot_time",
};

const uptimeSeconds = (bootTime, now) => {
  const bootMilliseconds = Date.parse(bootTime);
  if (!Number.isFinite(bootMilliseconds)) return null;
  return Math.max(0, Math.floor((now - bootMilliseconds) / 1000));
};

export function createLastBoot(options = {}) {
  const format = resolveFormat(options.format, DEFAULT_FORMAT, TOKENS, "last boot");
  const requestedFields = fieldsForFormat(format, TOKEN_FIELDS);
  const updateInterval = options.updateInterval ?? DEFAULT_UPDATE_INTERVAL;
  validateUpdateInterval(updateInterval);

  const element = document.createElement("section");
  const widget = new Widget(element, { type: "system" });
  element.className = ["webskin-system-widget", "webskin-system-widget--last-boot", options.className]
    .filter(Boolean)
    .join(" ");
  element.dataset.webskinSystemType = "last-boot";
  element.setAttribute("aria-live", "polite");

  const content = createPart("content", "", "div");
  element.append(content, createPart("status", "", "output"));

  let bootTime = null;
  let bootTimeLoaded = false;
  let activeBootUnsubscribe = null;
  let clockUnsubscribe = null;

  const render = (phase = bootTimeLoaded ? "ready" : "initial", now = Date.now()) => {
    renderTokenFormat(content, format, {
      "boot-time": formatText(bootTime, phase),
      uptime: formatInteger(
        bootTime ? uptimeSeconds(bootTime, now) : null,
        phase,
        0,
      ),
    }, { fallback: phase === "initial" ? "-" : "n/a" });
  };

  const unsubscribeBootTime = () => {
    activeBootUnsubscribe?.();
    activeBootUnsubscribe = null;
  };

  const subscribeBootTime = () => {
    if (activeBootUnsubscribe) return activeBootUnsubscribe;

    let unsubscribe;
    const cancel = () => {
      unsubscribe?.();
      if (activeBootUnsubscribe === cancel) activeBootUnsubscribe = null;
    };
    activeBootUnsubscribe = cancel;
    unsubscribe = systemMetricsManager.subscribe({
      endpoint: options.endpoint ?? "/api/system/metrics",
      widgetId: options.widgetId,
      updateInterval: DEFAULT_UPDATE_INTERVAL,
      fields: ["system.boot_time"],
      onSnapshot: (snapshot) => {
        bootTime = snapshot?.system?.boot_time ?? null;
        bootTimeLoaded = true;
        cancel();
        render("ready");
      },
      onError: () => {
        cancel();
        if (!bootTimeLoaded) render("error");
      },
    });
    return cancel;
  };

  Object.defineProperty(element, "subscribeBootTime", {
    configurable: true,
    value: subscribeBootTime,
  });
  Object.defineProperty(element, "unsubscribeBootTime", {
    configurable: true,
    value: unsubscribeBootTime,
  });

  render();
  subscribeBootTime();

  if (requestedFields.includes("system.boot_time") && format.includes("{uptime}")) {
    clockUnsubscribe = subscribeClock(
      (now) => render("ready", now.getTime()),
      { updateInterval },
    );
    widget.addCleanup(() => clockUnsubscribe?.());
  }
  widget.addCleanup(unsubscribeBootTime);
  return element;
}
