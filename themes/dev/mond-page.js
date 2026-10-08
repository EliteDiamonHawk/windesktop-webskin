import { createClock as createMondClock } from "/common/widgets/time/rainmeter-mond-clock-remake.js";

const gallery = document.querySelector("#mond-gallery");
let mondClock;

const mount = () => {
  if (!gallery || mondClock) return;

  const example = document.createElement("section");
  example.className = "widget-example";

  const heading = document.createElement("h3");
  heading.textContent = "Rainmeter Mond clock";

  const stage = document.createElement("div");
  stage.className = "widget-example__stage";
  stage.style.setProperty("--widget-scale", "1");

  mondClock = createMondClock();
  stage.append(mondClock);
  example.append(heading, stage);
  gallery.replaceChildren(example);
};

const unmount = () => {
  mondClock?.destroy?.();
  mondClock = undefined;
  gallery?.replaceChildren();
};

document.addEventListener("webskin:showcase-page-change", (event) => {
  if (event.detail.page === "mond") mount();
  else unmount();
});

if (!document.querySelector('[data-showcase-panel="mond"]')?.hidden) mount();
