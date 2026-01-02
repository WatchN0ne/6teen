(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Helpers
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const mapRange = (v, inMin, inMax, outMin, outMax) => {
    const t = (v - inMin) / (inMax - inMin);
    return outMin + clamp(t, 0, 1) * (outMax - outMin);
  };
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  // Year
  const year = $("#year");
  if (year) year.textContent = String(new Date().getFullYear());

  // Menu
  const menu = $("#menuPanel");
  const openBtn = document.querySelector('[data-open="menu"]');
  const closeBtn = document.querySelector('[data-close="menu"]');

  const setMenu = (open) => {
    if (!menu || !openBtn) return;
    menu.classList.toggle("is-open", open);
    menu.setAttribute("aria-hidden", String(!open));
    openBtn.setAttribute("aria-expanded", String(open));
    document.body.style.overflow = open ? "hidden" : "";
  };

  openBtn?.addEventListener("click", () => setMenu(true));
  closeBtn?.addEventListener("click", () => setMenu(false));
  menu?.addEventListener("click", (e) => { if (e.target === menu) setMenu(false); });
  $$(".menu__item", menu || document).forEach((a) => a.addEventListener("click", () => setMenu(false)));

  // Toast demo
  const toast = $("#toast");
  const toastBtn = document.querySelector('[data-toast="true"]');
  let toastT = null;
  toastBtn?.addEventListener("click", () => {
    if (!toast) return;
    toast.classList.add("is-on");
    clearTimeout(toastT);
    toastT = setTimeout(() => toast.classList.remove("is-on"), 1600);
  });

  // Make videos ultra-clean (no focus / no pip / no interaction)
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("video.heroVideo").forEach((v) => {
      v.controls = false;
      v.muted = true;
      v.loop = true;
      v.autoplay = true;

      v.disablePictureInPicture = true;
      v.setAttribute("disablepictureinpicture", "");
      v.setAttribute("controlslist", "nodownload noplaybackrate noremoteplayback");
      v.setAttribute("playsinline", "");
      v.setAttribute("webkit-playsinline", "");
      v.tabIndex = -1;

      v.addEventListener("focus", () => v.blur());
      v.addEventListener("click", (e) => e.preventDefault());
      v.addEventListener("contextmenu", (e) => e.preventDefault());

      // once metadata is ready, recalc (prevents “weird swoosh”)
      v.addEventListener("loadedmetadata", () => {
        window.dispatchEvent(new Event("resize"));
      }, { once: true });

      // try play (some browsers still need it)
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    });
  });

  // Anchor offset under sticky nav
  const navLinks = $$('a[href^="#"]').filter(a => (a.getAttribute("href") || "").length > 1);
  navLinks.forEach((a) => {
    a.addEventListener("click", (e) => {
      const hash = a.getAttribute("href");
      const target = hash ? document.querySelector(hash) : null;
      if (!target) return;
      e.preventDefault();
      const navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--navH"), 10) || 64;
      const top = target.getBoundingClientRect().top + window.scrollY - navH;
      window.scrollTo({ top, behavior: prefersReduced ? "auto" : "smooth" });
    });
  });

  // Lookbook rail thumb + drag
  const railTrack = document.querySelector("[data-rail-track]");
  const railThumb = document.querySelector("[data-rail-thumb]");
  if (railTrack && railThumb) {
    const updateRail = () => {
      const max = railTrack.scrollWidth - railTrack.clientWidth;
      const p = max > 0 ? railTrack.scrollLeft / max : 0;
      railThumb.style.transform = `translateX(${p * 400}%)`;
    };
    railTrack.addEventListener("scroll", updateRail, { passive: true });
    updateRail();

    let down = false, startX = 0, startScroll = 0;
    railTrack.addEventListener("pointerdown", (e) => {
      down = true;
      startX = e.clientX;
      startScroll = railTrack.scrollLeft;
      railTrack.setPointerCapture(e.pointerId);
    });
    railTrack.addEventListener("pointermove", (e) => {
      if (!down) return;
      railTrack.scrollLeft = startScroll - (e.clientX - startX);
    });
    const end = () => down = false;
    railTrack.addEventListener("pointerup", end);
    railTrack.addEventListener("pointercancel", end);
    railTrack.addEventListener("mouseleave", end);
  }

  // Collect swoosh sections
  const swooshes = $$("[data-swoosh]")
    .map((sec) => {
      const sticky = sec.querySelector("[data-sticky]");
      const visual = sec.querySelector("[data-visual]");
      const frame = sec.querySelector("[data-frame]");
      const win = sec.querySelector("[data-window]");
      const copy = sec.querySelector(".swoosh__copy");
      const hint = sec.querySelector(".scrollHint");
      return { sec, sticky, visual, frame, win, copy, hint };
    })
    .filter(x => x.sticky && x.visual && x.frame && x.win);

  let ticking = false;

  function updateSwoosh(s) {
    if (prefersReduced) return;

    const { sec, sticky, visual, frame, win, copy, hint } = s;

    const total = sec.offsetHeight - sticky.offsetHeight;
    const scrolled = clamp(window.scrollY - sec.offsetTop, 0, total);
    const p = total > 0 ? scrolled / total : 0;

    // Copy fades a bit later (prevents “empty moment”)
    if (copy) {
      const hideT = clamp((p - 0.14) / 0.22, 0, 1);
      const eHide = ease(hideT);
      copy.style.opacity = String(1 - eHide);
      copy.style.transform = `translate3d(0, ${-26 * eHide}px, 0)`;
      copy.style.filter = `blur(${6 * eHide}px)`;
      copy.style.pointerEvents = eHide > 0.85 ? "none" : "auto";
    }

    if (hint) {
      hint.style.opacity = String(1 - mapRange(p, 0.14, 0.30, 0, 1));
    }

    // Frame reveal earlier
    const frameOpacity = mapRange(p, 0.16, 0.42, 0, 1);
    frame.style.opacity = String(frameOpacity);

    // Fit animation
    const tStart = 0.18;
    const tEnd = 0.78;
    const t = clamp((p - tStart) / (tEnd - tStart), 0, 1);
    const e = ease(t);

    const start = visual.getBoundingClientRect();
    const end = win.getBoundingClientRect();

    const startCx = start.left + start.width / 2;
    const startCy = start.top + start.height / 2;
    const endCx = end.left + end.width / 2;
    const endCy = end.top + end.height / 2;

    const dx = (endCx - startCx) * e;
    const dy = (endCy - startCy) * e;

    const sx = end.width / start.width;
    const sy = end.height / start.height;
    const sTarget = Math.min(sx, sy);
    const scale = lerp(1, sTarget, e);

    const blur = lerp(0, 1.3, e);
    const op = lerp(1, 0.92, e);

    visual.style.transformOrigin = "center center";
    visual.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${scale})`;
    visual.style.filter = `blur(${blur}px)`;
    visual.style.opacity = String(op);

    // Frame settle
    const settle = ease(mapRange(p, 0.30, 0.88, 0, 1));
    const frameScale = lerp(0.92, 1.0, settle);
    const frameTy = lerp(10, 0, settle);
    frame.style.transform = `translate3d(-50%, ${-46 + (-frameTy/2)}%, 0) scale(${frameScale})`;

    // Magazine “throw-away” at very end (only for chapter01 hero)
    if (sec.classList.contains("swoosh--hero")) {
      const toss = clamp((p - 0.86) / 0.14, 0, 1);
      const eToss = ease(toss);

      // frame tilts + moves out
      const rot = lerp(0, -10, eToss);
      const tx = lerp(0, -140, eToss);
      const ty = lerp(0, -180, eToss);
      const fOp = lerp(1, 0, eToss);

      frame.style.opacity = String(frameOpacity * fOp);
      frame.style.transform = `translate3d(calc(-50% + ${tx}px), calc(-46% + ${ty}px), 0) rotate(${rot}deg) scale(${frameScale})`;

      // visual soft fade after toss starts
      const vOp = lerp(op, 0.65, eToss);
      visual.style.opacity = String(vOp);
    }
  }

  function update() {
    ticking = false;
    for (const s of swooshes) updateSwoosh(s);
  }

  function requestTick() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  window.addEventListener("scroll", requestTick, { passive: true });
  window.addEventListener("resize", requestTick, { passive: true });

  update();
})();
