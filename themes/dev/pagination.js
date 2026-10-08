(() => {
  const buttons = [...document.querySelectorAll("[data-showcase-page]")];
  const panels = [...document.querySelectorAll("[data-showcase-panel]")];
  const previous = document.querySelector("[data-showcase-previous]");
  const next = document.querySelector("[data-showcase-next]");
  const status = document.querySelector("[data-showcase-status]");
  const pages = buttons.map((button) => button.dataset.showcasePage);
  let activePage = pages[0];

  const showPage = (page) => {
    const pageIndex = pages.indexOf(page);
    if (pageIndex < 0) return;
    activePage = page;

    panels.forEach((panel) => {
      const isActive = panel.dataset.showcasePanel === page;
      panel.hidden = !isActive;
      panel.setAttribute("aria-hidden", String(!isActive));
    });
    buttons.forEach((button) => {
      if (button.dataset.showcasePage === page) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    if (previous) previous.disabled = pageIndex === 0;
    if (next) next.disabled = pageIndex === pages.length - 1;
    if (status) status.textContent = `Page ${pageIndex + 1} of ${pages.length}`;

    document.dispatchEvent(new CustomEvent("webskin:showcase-page-change", {
      detail: { page },
    }));
  };

  buttons.forEach((button) => {
    button.addEventListener("click", () => showPage(button.dataset.showcasePage));
  });
  previous?.addEventListener("click", () => showPage(pages[pages.indexOf(activePage) - 1]));
  next?.addEventListener("click", () => showPage(pages[pages.indexOf(activePage) + 1]));
  showPage(activePage);
})();
