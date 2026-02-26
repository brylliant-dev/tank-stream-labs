/* Start of Code for Stat Counter */
document.addEventListener("DOMContentLoaded", () => {
  const items = Array.from(document.querySelectorAll(".stats_number-item .heading-48, .stats_number-item .heading-64"));
  if (!items.length) return;

  const DURATION_MS = 1400;
  const STAGGER_MS = 220;
  const FPS = 60;

  const getNumberTextOnly = (el) =>
    Array.from(el.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent)
      .join("")
      .trim();

  const formatNumber = (n, useCommas) => {
    const rounded = Math.max(0, Math.round(n));
    return useCommas ? rounded.toLocaleString() : String(rounded);
  };

  // --- 1) Parse originals + prepare DOM to prevent width shifts ---
  const parsed = items
    .map((el) => {
      const caption = el.querySelector(".stat-caption");
      const captionHTML = caption ? caption.outerHTML : "";

      const raw = getNumberTextOnly(el);
      const hasPlus = /\+/.test(raw);
      const useCommas = /,/.test(raw);

      const targetStr = raw.replace(/[^\d]/g, "");
      const target = targetStr ? parseInt(targetStr, 10) : 0;
      if (!target) return null;

      // Final text we want to reserve space for
      const finalText = `${formatNumber(target, useCommas)}${hasPlus ? "+" : ""}`;

      return { el, captionHTML, target, hasPlus, useCommas, finalText };
    })
    .filter(Boolean);

  if (!parsed.length) return;

  // Create a hidden measurer that matches the <p>'s typography
  const measurer = document.createElement("span");
  measurer.setAttribute("aria-hidden", "true");
  measurer.style.position = "absolute";
  measurer.style.visibility = "hidden";
  measurer.style.whiteSpace = "nowrap";
  measurer.style.pointerEvents = "none";
  document.body.appendChild(measurer);

  // Reserve fixed width for the number part and rebuild structure:
  // <span class="stat-num">...</span><span class="stat-caption">...</span>
  parsed.forEach(({ el, captionHTML, finalText }) => {
    const cs = window.getComputedStyle(el);

    // Ensure measurer uses same font styles as the <p>
    measurer.style.fontFamily = cs.fontFamily;
    measurer.style.fontSize = cs.fontSize;
    measurer.style.fontWeight = cs.fontWeight;
    measurer.style.letterSpacing = cs.letterSpacing;
    measurer.style.textTransform = cs.textTransform;

    measurer.textContent = finalText;
    const finalWidth = Math.ceil(measurer.getBoundingClientRect().width);

    // Rebuild content with fixed-width number wrapper
    el.innerHTML = `
      <span class="stat-num" style="
        display:inline-block;
        width:${finalWidth}px;
        white-space:nowrap;
        text-align:left;
      ">0</span>${captionHTML}
    `;
  });

  measurer.remove();

  // --- 2) Animate numbers without changing widths ---
  const animate = ({ el, target, hasPlus, useCommas }, delay) => {
    const numEl = el.querySelector(".stat-num");
    if (!numEl) return;

    const totalFrames = Math.max(1, Math.round((DURATION_MS / 1000) * FPS));
    let frame = 0;

    const tick = () => {
      frame++;
      const t = Math.min(1, frame / totalFrames);
      const eased = 1 - Math.pow(1 - t, 3);

      const current = target * eased;
      const text = `${formatNumber(current, useCommas)}${hasPlus ? "+" : ""}`;
      numEl.textContent = text;

      if (t < 1) requestAnimationFrame(tick);
      else numEl.textContent = `${formatNumber(target, useCommas)}${hasPlus ? "+" : ""}`;
    };

    setTimeout(() => requestAnimationFrame(tick), delay);
  };

  // Optional: run only when container is in view
  const container = document.querySelector(".stats_numbers");
  if (!container) {
    parsed.forEach((item, i) => animate(item, i * STAGGER_MS));
    return;
  }

  let hasRun = false;
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries[0].isIntersecting || hasRun) return;
      hasRun = true;
      parsed.forEach((item, i) => animate(item, i * STAGGER_MS));
      io.disconnect();
    },
    { threshold: 0.35 }
  );

  io.observe(container);
});
/* End of Code for Stat Counter */
