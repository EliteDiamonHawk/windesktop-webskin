import { createClock as createPlainClock } from "/common/widgets/clock/digital-plain.js";
import { createClock as createPlainAnalogClock } from "/common/widgets/clock/analog-plain.js";
import { createClock as createDigitalClock } from "/common/widgets/clock/digital-prestyled.js";
import { createClock as createAnalogClock } from "/common/widgets/clock/analog-prestyled.js";
import { createClock as createAnalogClock2 } from "/common/widgets/clock/analog-prestyled2.js";
import { createClock as createDigitalAnalogClock } from "/common/widgets/clock/digital-analog-prestyled.js";

document.querySelector("#clock").append(createPlainClock());
document.querySelector("#analog-plain-clock").append(createPlainAnalogClock());
document.querySelector("#digital-clock").append(createDigitalClock());
document.querySelector("#analog-clock").append(createAnalogClock());
document.querySelector("#analog-clock-2").append(createAnalogClock2({
  size: "9rem",
}));

document.querySelector("#combination-clock").append(createDigitalAnalogClock({
  analogSize: "8rem",
}));

const editor = document.querySelector("#clock-editor");
const preview = document.querySelector("#editor-preview");
const resetButton = document.querySelector("[data-reset-editor]");
const defaults = {
  variant: "digital",
  format: "24h",
  color: "#cfb5ab",
  background: "#5b4841",
  frame: "#5b4841",
  size: "2.7",
  radius: "12",
  padding: "12",
  spacing: "8",
  seconds: true,
  period: true,
};

const field = (name) => editor?.elements.namedItem(name);

const syncOutputs = () => {
  if (!editor) return;
  const size = field("size");
  const radius = field("radius");
  const padding = field("padding");
  const spacing = field("spacing");
  const output = (name, value) => {
    const outputElement = editor.querySelector(`[data-output="${name}"]`);
    if (outputElement) outputElement.textContent = value;
  };
  output("size", `${size.value}rem`);
  output("radius", `${radius.value}px`);
  output("padding", `${padding.value}px`);
  output("spacing", `${(Number(spacing.value) / 100).toFixed(2)}em`);
};

const renderEditorClock = () => {
  if (!editor || !preview) return;
  const values = new FormData(editor);
  const variant = values.get("variant");
  const format = values.get("format");
  const size = `${values.get("size")}rem`;
  const padding = `${values.get("padding")}px`;
  const clockOptions = {
    format,
    seconds: values.get("seconds") === "on",
    showPeriod: values.get("period") === "on",
    color: values.get("color"),
  };
  const clock = variant === "plain"
    ? createPlainClock(clockOptions)
    : variant === "analog"
      ? createAnalogClock({ size, color: values.get("color"), faceColor: values.get("background"), frameColor: values.get("frame"), showSeconds: clockOptions.seconds })
      : createDigitalClock(clockOptions);
  clock.style.color = values.get("color");
  clock.style.backgroundColor = values.get("background");
  clock.style.borderColor = values.get("frame");
  clock.style.borderRadius = `${values.get("radius")}px`;
  clock.style.fontSize = size;
  clock.style.letterSpacing = `${Number(values.get("spacing")) / 100}em`;
  clock.style.padding = padding;
  preview.replaceChildren(clock);
  syncOutputs();
};

const setEditorDefaults = () => {
  if (!editor) return;
  for (const [name, value] of Object.entries(defaults)) {
    const input = field(name);
    if (!input) continue;
    if (input.type === "checkbox") input.checked = value;
    else input.value = value;
  }
  renderEditorClock();
};

editor?.addEventListener("input", renderEditorClock);
editor?.addEventListener("change", renderEditorClock);
resetButton?.addEventListener("click", setEditorDefaults);
setEditorDefaults();
