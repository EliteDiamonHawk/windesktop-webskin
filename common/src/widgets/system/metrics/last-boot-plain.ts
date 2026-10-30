import { subscribeClock, validateUpdateInterval } from "../../time/time-scheduler.js";
import { createPart, createSystemWidget, fieldsForFormat, renderTokenFormat, resolveFormat, systemMetricsManager } from "./client.js";
import { formatInteger, formatText } from "./formatters.js";
import { rejectLegacyInterval } from "../../dom.js";

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
  rejectLegacyInterval(options);
  const format = resolveFormat(options.format, DEFAULT_FORMAT, TOKENS, "last boot");
  const updateInterval = options.updateInterval ?? DEFAULT_UPDATE_INTERVAL;
  validateUpdateInterval(updateInterval);
  let bootTime = null;
  let bootTimeLoaded = false;

  const renderValues = (root, phase = bootTimeLoaded ? "ready" : "initial", now = Date.now()) => {
    renderTokenFormat(root.querySelector('[data-webskin-system-part="content"]'), format, {
      "boot-time": formatText(bootTime, phase),
      uptime: formatInteger(bootTime ? uptimeSeconds(bootTime, now) : null, phase, 0),
    }, { fallback: phase === "initial" ? "-" : "n/a" });
  };

  const subscribeOnce = ({ endpoint, updateInterval: updateIntervalSeconds, fields, onSnapshot, onError }) => {
    let unsubscribe;
    const cancel = () => unsubscribe?.();
    cancel.once = true;
    unsubscribe = systemMetricsManager.subscribe({
      endpoint,
      updateInterval: updateIntervalSeconds,
      fields,
      onSnapshot: (snapshot) => {
        onSnapshot(snapshot);
        cancel();
      },
      onError: (error) => {
        onError(error);
        cancel();
      },
    });
    return cancel;
  };

  return createSystemWidget({
    ...options,
    type: "last-boot",
    variant: "plain",
    updateInterval,
    family: "standard",
    fields: fieldsForFormat(format, TOKEN_FIELDS),
    build: (root) => root.append(createPart("content", "", "div")),
    render: (root, snapshot, { phase }) => {
      renderValues(root, phase);
    },
    subscribe: subscribeOnce,
    onSnapshot: (snapshot) => {
      bootTime = snapshot?.system?.boot_time ?? null;
      bootTimeLoaded = true;
    },
    onRuntime: (runtime) => {
      Object.defineProperty(runtime.element, "subscribeBootTime", {
        configurable: true,
        value: runtime.subscribe,
      });
      Object.defineProperty(runtime.element, "unsubscribeBootTime", {
        configurable: true,
        value: runtime.unsubscribe,
      });
      if (format.includes("{uptime}")) {
        runtime.widget.addCleanup(subscribeClock(
          (now) => renderValues(runtime.renderRoot, "ready", now.getTime()),
          { updateInterval },
        ));
      }
    },
  });
}
