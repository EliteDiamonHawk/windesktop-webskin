import { createClock as createMondClock } from "/common/widgets/time/rainmeter-mond-clock-copy.js";

const stage = document.querySelector("#mond-clock");
let mondClock;

document.addEventListener("webskin:showcase-page-change", (event) => {
  if (!stage) return;
  if (event.detail.page === "mond") {
    if (!mondClock) {
      mondClock = createMondClock();
      stage.replaceChildren(mondClock);
    }
    return;
  }

  mondClock?.destroy?.();
  mondClock = undefined;
  stage.replaceChildren();
});
