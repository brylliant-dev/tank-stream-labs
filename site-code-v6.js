/* Start of Code for Stat Counter */
document.addEventListener("DOMContentLoaded", () => {
  const items = Array.from(
    document.querySelectorAll(".stats_number-item .heading-48, .stats_number-item .heading-64")
  );
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

  // Extract prefix (e.g. "#"), numeric part, suffix (e.g. "+")
  const splitAffixes = (raw) => {
    const cleaned = (raw || "").replace(/\s+/g, " ").trim();

    // Capture: [anything before first digit] [digits/commas/spaces] [anything after last digit]
    const m = cleaned.match(/^([^\d]*)([\d,\s]+)([^\d]*)$/);

    if (m) {
      const prefix = (m[1] || "").trim();            // e.g. "#"
      const numPart = (m[2] || "").trim();           // e.g. "1" or "12,345"
      const suffix = (m[3] || "").trim();            // e.g. "+"
      const useCommas = /,/.test(numPart);

      const targetStr = numPart.replace(/[^\d]/g, "");
      const target = targetStr ? parseInt(targetStr, 10) : 0;

      return { prefix, suffix, useCommas, target };
    }

    // Fallback (previous behavior)
    const hasPlus = /\+/.test(cleaned);
    const useCommas = /,/.test(cleaned);
    const targetStr = cleaned.replace(/[^\d]/g, "");
    const target = targetStr ? parseInt(targetStr, 10) : 0;

    return { prefix: "", suffix: hasPlus ? "+" : "", useCommas, target };
  };

  // --- 1) Parse originals + prepare DOM to prevent width shifts ---
  const parsed = items
    .map((el) => {
      const caption = el.querySelector(".stat-caption");
      const captionHTML = caption ? caption.outerHTML : "";

      const raw = getNumberTextOnly(el);
      const { prefix, suffix, useCommas, target } = splitAffixes(raw);

      if (!target) return null;

      // Reserve space for final text, including prefix/suffix (handles "#1", "250+", etc.)
      const finalText = `${prefix}${formatNumber(target, useCommas)}${suffix}`;

      return { el, captionHTML, target, prefix, suffix, useCommas, finalText };
    })
    .filter(Boolean);

  if (!parsed.length) return;

  // Hidden measurer matching typography
  const measurer = document.createElement("span");
  measurer.setAttribute("aria-hidden", "true");
  measurer.style.position = "absolute";
  measurer.style.visibility = "hidden";
  measurer.style.whiteSpace = "nowrap";
  measurer.style.pointerEvents = "none";
  document.body.appendChild(measurer);

  // Reserve fixed width for the number part and rebuild structure
  parsed.forEach(({ el, captionHTML, finalText, prefix, suffix }) => {
    const cs = window.getComputedStyle(el);

    measurer.style.fontFamily = cs.fontFamily;
    measurer.style.fontSize = cs.fontSize;
    measurer.style.fontWeight = cs.fontWeight;
    measurer.style.letterSpacing = cs.letterSpacing;
    measurer.style.textTransform = cs.textTransform;

    measurer.textContent = finalText;
    const finalWidth = Math.ceil(measurer.getBoundingClientRect().width);

    // Keep captionHTML as-is, but never risk HTML injection for the number text
    el.innerHTML = `
      <span class="stat-num" style="
        display:inline-block;
        width:${finalWidth}px;
        white-space:nowrap;
        text-align:left;
      "></span>${captionHTML}
    `;

    const numEl = el.querySelector(".stat-num");
    if (numEl) numEl.textContent = `${prefix}${formatNumber(0, false)}${suffix}`; // e.g. "#0"
  });

  measurer.remove();

  // --- 2) Animate numbers without changing widths ---
  const animate = ({ el, target, prefix, suffix, useCommas }, delay) => {
    const numEl = el.querySelector(".stat-num");
    if (!numEl) return;

    const totalFrames = Math.max(1, Math.round((DURATION_MS / 1000) * FPS));
    let frame = 0;

    const tick = () => {
      frame++;
      const t = Math.min(1, frame / totalFrames);
      const eased = 1 - Math.pow(1 - t, 3);

      const current = target * eased;
      numEl.textContent = `${prefix}${formatNumber(current, useCommas)}${suffix}`;

      if (t < 1) requestAnimationFrame(tick);
      else numEl.textContent = `${prefix}${formatNumber(target, useCommas)}${suffix}`;
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


/* =========================================================
   START: FlexLocation – Swipe on CMS Titles + Sync Background Slider
   Purpose:
   - Initializes the background Swiper (fade effect, optional loop, pagination)
   - Keeps title slides in sync with the active background slide
   - Enables swipe gestures on the CMS dynamic wrapper (w-dyn-items) on touch devices
   - Allows clicking a title to jump to the corresponding background slide
========================================================= */
(function ($) {
  "use strict";

  var Webflow = window.Webflow || [];
  Webflow.push(function () {
    if (typeof window.Swiper === "undefined") {
      console.error("[FlexLocation] Swiper is not loaded.");
      return;
    }

    $(".flex-location_slider-wrapper").each(function () {
      const $wrap = $(this);

      // Guard against double init
      if ($wrap.attr("data-flexlocation-init") === "true") return;
      $wrap.attr("data-flexlocation-init", "true");

      const bgEl = $wrap.find(".swiper.is-slider-bg")[0];
      if (!bgEl) return;

      const $titleSlides = $wrap.find(".swiper-slide.is-slider-titles");
      const bgSlidesCount = $wrap.find(".swiper-slide.is-slider-bg").length;
      if (bgSlidesCount < 1) return;

      const shouldLoop = bgSlidesCount > 1;

      // Pagination (outside swiper is OK)
      const paginationEl = $wrap.find(".slider-bg_component .swiper-pagination")[0] || null;

      // Init BG swiper
      const bgSwiper = new Swiper(bgEl, {
        slidesPerView: 1,
        speed: 400,
        effect: "fade",
        fadeEffect: { crossFade: true },
        loop: shouldLoop,

        // Swipe on mobile only
        allowTouchMove: false,
        breakpoints: {
          0: { allowTouchMove: true },
          768: { allowTouchMove: false }
        },

        ...(paginationEl ? { pagination: { el: paginationEl } } : {})
      });

      function setActiveTitle(realIndex) {
        if (!$titleSlides.length) return;
        $titleSlides.removeClass("is-active");
        $titleSlides.eq(realIndex).addClass("is-active");
      }

      setActiveTitle(bgSwiper.realIndex || 0);
      bgSwiper.on("slideChange", function () {
        setActiveTitle(bgSwiper.realIndex);
      });

      // Keep interactive elements clickable
      $wrap.on("click", "a, button, [role='button']", function (e) {
        e.stopPropagation();
      });

      // Tap title slide to jump
      $wrap.on("click", ".swiper-slide.is-slider-titles", function (e) {
        if ($(e.target).closest("a, button, [role='button']").length) return;

        const idx = $(this).index();
        if (shouldLoop && typeof bgSwiper.slideToLoop === "function") bgSwiper.slideToLoop(idx);
        else bgSwiper.slideTo(idx);
      });

      // Bind swipe gesture to the CMS moving wrapper (w-dyn-items)
      (function bindDynTitlesSwipe() {
        const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
        if (!isTouch) return;

        const $swipeSurface = $wrap
          .find(".swiper-wrapper.is-slider-titles.w-dyn-items")
          .first();

        const $fallbackSurface = $wrap.find(".swiper.is-slider-titles").first();

        const $surface = $swipeSurface.length ? $swipeSurface : $fallbackSurface;
        if (!$surface.length) return;

        // Allow horizontal intent
        $surface.css("touch-action", "pan-y");

        let startX = 0, startY = 0;
        let tracking = false;

        const THRESH_X = 30;
        const CANCEL_Y = 60;

        $surface.on("touchstart", function (e) {
          if ($(e.target).closest("a, button, [role='button']").length) return;

          const t = e.originalEvent.touches && e.originalEvent.touches[0];
          if (!t) return;

          startX = t.clientX;
          startY = t.clientY;
          tracking = true;
        });

        $surface.on("touchmove", function (e) {
          if (!tracking) return;

          const t = e.originalEvent.touches && e.originalEvent.touches[0];
          if (!t) return;

          const dx = t.clientX - startX;
          const dy = t.clientY - startY;

          if (Math.abs(dy) > CANCEL_Y && Math.abs(dy) > Math.abs(dx)) {
            tracking = false;
            return;
          }

          if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
            e.preventDefault();
          }
        });

        $surface.on("touchend", function (e) {
          if (!tracking) return;
          tracking = false;

          const t = e.originalEvent.changedTouches && e.originalEvent.changedTouches[0];
          if (!t) return;

          const dx = t.clientX - startX;
          const dy = t.clientY - startY;

          if (Math.abs(dx) < THRESH_X || Math.abs(dx) < Math.abs(dy)) return;

          if (!bgSwiper.allowTouchMove) return;

          if (dx < 0) bgSwiper.slideNext();
          else bgSwiper.slidePrev();
        });
      })();

      // Optional arrows
      const nextEl = $wrap.find(".swiper-next");
      const prevEl = $wrap.find(".swiper-prev");

      if (nextEl.length) {
        nextEl.on("click", function (e) {
          e.preventDefault();
          bgSwiper.slideNext();
        });
      }
      if (prevEl.length) {
        prevEl.on("click", function (e) {
          e.preventDefault();
          bgSwiper.slidePrev();
        });
      }
    });
  });
})(window.jQuery);
/* =========================================================
   END: FlexLocation – Swipe on CMS Titles + Sync Background Slider
========================================================= */


/* =========================================================
   START: Location Hover – Marquee Auto-Scroll (Pause on Hover)
   Purpose:
   - Animates a horizontal marquee (track) continuously
   - Pauses the marquee when the user hovers the wrapper
   - Assumes content is duplicated once (scrollWidth / 2 loop)
========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  const wrap = document.querySelector('[data-marquee="wrap"]');
  const track = document.querySelector('[data-marquee="track"]');
  if (!wrap || !track) return;

  wrap.style.overflow = "hidden";

  // Expect: track contains ONE group as first child
  const group = track.firstElementChild;
  if (!group) return;

  // Clone group once (if not already)
  if (track.children.length < 2) {
    const clone = group.cloneNode(true);
    clone.setAttribute("aria-hidden", "true");
    track.appendChild(clone);
  }

  track.style.display = "flex";
  track.style.flexWrap = "nowrap";
  track.style.willChange = "transform";

  let x = 0;

  const BASE_SPEED = 30; // px/sec
  let currentSpeed = BASE_SPEED;

  // Smooth ramp settings
  const STOP_DURATION = 0.6;  // seconds to slow to 0
  const START_DURATION = 0.8; // seconds to ramp back to BASE_SPEED

  let speedFrom = BASE_SPEED;
  let speedTo = BASE_SPEED;
  let rampStart = performance.now();
  let rampDuration = 0;

  let loopW = 0;

  const clamp01 = (t) => Math.min(1, Math.max(0, t));
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const lerp = (a, b, t) => a + (b - a) * t;

  const startRamp = (toSpeed, durationSec) => {
    speedFrom = currentSpeed;
    speedTo = toSpeed;
    rampStart = performance.now();
    rampDuration = Math.max(0.001, durationSec * 1000);
  };

  const measure = () => {
    loopW = group.getBoundingClientRect().width;

    if (loopW > 0) {
      x = x % loopW;
      if (x > 0) x -= loopW; // keep x in [-loopW, 0]
    }
  };

  // Smooth pause/resume
  wrap.addEventListener("mouseenter", () => startRamp(0, STOP_DURATION));
  wrap.addEventListener("mouseleave", () => startRamp(BASE_SPEED, START_DURATION));

  window.addEventListener("resize", measure);
  const ro = new ResizeObserver(measure);
  ro.observe(group);
  window.addEventListener("load", measure);

  measure();

  let last = performance.now();
  function raf(now) {
    const dt = (now - last) / 1000;
    last = now;

    // Update speed via time-based ramp
    const t = clamp01((now - rampStart) / rampDuration);
    currentSpeed = lerp(speedFrom, speedTo, easeOutCubic(t));

    x -= currentSpeed * dt;

    // Seamless loop
    if (loopW > 0 && x <= -loopW) x += loopW;

    track.style.transform = `translate3d(${x}px,0,0)`;
    requestAnimationFrame(raf);
  }

  requestAnimationFrame(raf);
});
/* =========================================================
   END: Location Hover – Marquee Auto-Scroll (Pause on Hover)
========================================================= */


/* =========================================================
   START: Testimonial Slider (Swiper Init)
   Purpose:
   - Initializes Swiper for each testimonial collection instance
   - Enables autoplay, pagination, and navigation arrows
   - Removes ARIA roles from swiper wrappers/slides to avoid Webflow conflicts
========================================================= */
$(document).ready(function() {
  $(".swiper-wrapper").removeAttr("role");
  $(".swiper-slide").removeAttr("role");

  $(".testimonial_collection").each(function () {
    const swiper = new Swiper($(this).find(".swiper")[0], {
      direction: "horizontal",
      loop: true,
      slidesPerView: "auto",
      simulateTouch: true,
      grabCursor: true,
      allowTouchMove: true,
      spaceBetween: 20,
      speed: 900,
      autoplay: {
        delay: 15000,
        disableOnInteraction: false,
      },
      pagination: {
        el: ".swiper-pagination",
        clickable: true,
      },
      navigation: {
        nextEl: ".next",
        prevEl: ".prev",
      },
    });
  });
});
/* =========================================================
   END: Testimonial Slider (Swiper Init)
========================================================= */



/* =========================================================
   Nav Scroll Lock + Manual Scroll Toggle
   - Disables page scroll when Webflow nav menu is open
   - Restores scroll position when nav closes
   - Optionally stops/starts Lenis (if window.lenis exists)
   - Manual toggle via [data-scroll="disable"] / [data-scroll="enable"]
========================================================= */
(() => {
  let scrollY = 0;
  let isLocked = false;

  const getLenis = () => window.lenis || null;

  function lockScroll() {
    if (isLocked) return;
    isLocked = true;
    scrollY = window.scrollY || window.pageYOffset || 0;
    const b = document.body;
    b.style.position = "fixed";
    b.style.top = `-${scrollY}px`;
    b.style.left = "0";
    b.style.right = "0";
    b.style.width = "100%";
    b.style.overflow = "hidden";
    const lenis = getLenis();
    if (lenis && typeof lenis.stop === "function") lenis.stop();
  }

  function unlockScroll() {
    if (!isLocked) return;
    isLocked = false;
    const b = document.body;
    b.style.position = "";
    b.style.top = "";
    b.style.left = "";
    b.style.right = "";
    b.style.width = "";
    b.style.overflow = "";
    window.scrollTo(0, scrollY);
    const lenis = getLenis();
    if (lenis && typeof lenis.start === "function") lenis.start();
  }

  function isNavOpen(navEl) {
    const btn = navEl.querySelector(".w-nav-button");
    const menu = navEl.querySelector(".w-nav-menu");
    return (!!btn && btn.classList.contains("w--open")) ||
           (!!menu && menu.classList.contains("w--open"));
  }

  function sync(navEl) {
    isNavOpen(navEl) ? lockScroll() : unlockScroll();
  }

  function observeOpenState(navEl) {
    if (navEl._scrollLockInit) return; // prevent double-init
    navEl._scrollLockInit = true;

    const btn = navEl.querySelector(".w-nav-button");
    const menu = navEl.querySelector(".w-nav-menu");
    if (!btn && !menu) return;

    const mo = new MutationObserver(() => sync(navEl));
    if (btn) mo.observe(btn, { attributes: true, attributeFilter: ["class"] });
    if (menu) mo.observe(menu, { attributes: true, attributeFilter: ["class"] });

    navEl.addEventListener("click", (e) => {
      if (e.target.closest(".w-nav-menu a")) setTimeout(() => sync(navEl), 50);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setTimeout(() => sync(navEl), 50);
    });

    sync(navEl);
  }

  function init() {
    document.querySelectorAll(".w-nav").forEach(observeOpenState);
  }

  // Manual [data-scroll] toggle
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-scroll]");
    if (!el) return;
    const action = el.getAttribute("data-scroll");
    if (action === "disable") lockScroll();
    if (action === "enable") unlockScroll();
  });

  // ── Init strategy: handles both early and late script execution ──
  if (document.readyState === "loading") {
    // DOM not ready yet — wait for it
    document.addEventListener("DOMContentLoaded", init);
  } else {
    // DOM already ready (common in Webflow) — run immediately
    init();
  }

  // Webflow re-renders on page transitions — re-init to be safe
  window.addEventListener("load", init);

})();
/* =========================================================
   END: Nav Scroll Lock (Webflow Nav Open = Disable Body Scroll)
========================================================= */


/* =========================================================
   START: Nav Location Hover (Desktop 992px+ Only)
   Purpose:
   - Adds hover animation for nav location items on desktop
   - Smoothly fades/slides the icon in on hover, fades out on leave
   - Automatically binds/unbinds when crossing the 992px breakpoint
========================================================= */
(function ($) {
  "use strict";

  const ITEM = ".nav-location_default_nest-item";
  const ICON = ".location_popup_link-icon";
  const DURATION = 500;
  const FADE_OUT_DELAY = 160;
  const MQ_DESKTOP = window.matchMedia("(min-width: 992px)");
  const NS = ".navLocHover";

  const resetState = () => {
    $(ITEM).each(function () {
      const $item = $(this);
      const t = $item.data("imgOutTimer");
      if (t) clearTimeout(t);

      $item.removeClass("is-img-open").removeData("imgOutTimer");
      $item.find(ICON).stop(true, true).css({
        opacity: 0,
        transform: "translateX(0em)",
        transition: "none",
      });
    });
  };

  const bind = () => {
    resetState();

    $(document)
      .off("mouseenter" + NS, ITEM)
      .off("mouseleave" + NS, ITEM);

    $(document).on("mouseenter" + NS, ITEM, function () {
      const $item = $(this);
      const $icon = $item.find(ICON);

      const t = $item.data("imgOutTimer");
      if (t) clearTimeout(t);

      $item.addClass("is-img-open");

      $icon.stop(true, true).css({
        opacity: 0,
        transform: "translateX(-1em)",
        transition: "none",
      });

      if ($icon[0]) void $icon[0].offsetHeight;

      requestAnimationFrame(() => {
        $icon.css({
          transition: `transform ${DURATION}ms ease`,
          transform: "translateX(0em)",
        });
      });

      $icon.animate({ opacity: 1 }, { duration: DURATION, queue: false });
    });

    $(document).on("mouseleave" + NS, ITEM, function () {
      const $item = $(this);
      const $icon = $item.find(ICON);

      $icon.stop(true, true);
      $icon.css({
        transition: `transform ${DURATION}ms ease`,
        transform: "translateX(0em)",
      });
      $icon.animate({ opacity: 0 }, { duration: DURATION, queue: false });

      const timer = setTimeout(() => {
        $item.removeClass("is-img-open");
        $item.removeData("imgOutTimer");
      }, FADE_OUT_DELAY);

      $item.data("imgOutTimer", timer);
    });
  };

  const unbind = () => {
    $(document).off(NS);
    resetState();
  };

  const apply = () => {
    if (MQ_DESKTOP.matches) bind();
    else unbind();
  };

  $(function () {
    apply();

    if (MQ_DESKTOP.addEventListener) MQ_DESKTOP.addEventListener("change", apply);
    else MQ_DESKTOP.addListener(apply);
  });
})(jQuery);
/* =========================================================
   END: Nav Location Hover (Desktop 992px+ Only)
========================================================= */


/* =========================================================
   START: Hide Banner Wrapper if CMS List is Empty
   Purpose:
   - If the banner collection list is missing, hides the banner wrapper
   - Useful when a CMS Collection List may not render on some pages
========================================================= */
$(document).ready(function() {
  var collectionList = $(".banner-collection_wrapper.w-dyn-list");
  var sectionToHide = $(".banner-wrapper");

  if (collectionList.length === 0) {
    sectionToHide.css("display", "none");
  }
});
/* =========================================================
   END: Hide Banner Wrapper if CMS List is Empty
========================================================= */
