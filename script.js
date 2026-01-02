(() => {
  "use strict";

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp  = (a, b, t) => a + (b - a) * t;
  const ease  = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  // year
  const year = $("#year");
  if (year) year.textContent = String(new Date().getFullYear());

  // menu
  const menu = $("#menu");
  const openBtn = $("[data-menu-open]");
  const closeBtn = $("[data-menu-close]");

  function setMenu(open){
    if (!menu || !openBtn) return;
    menu.classList.toggle("is-open", open);
    menu.setAttribute("aria-hidden", String(!open));
    openBtn.setAttribute("aria-expanded", String(open));
    document.body.style.overflow = open ? "hidden" : "";
  }

  openBtn?.addEventListener("click", () => setMenu(true));
  closeBtn?.addEventListener("click", () => setMenu(false));
  menu?.addEventListener("click", (e) => { if (e.target === menu) setMenu(false); });
  $$(".menu__item", menu || document).forEach(a => a.addEventListener("click", () => setMenu(false)));

  // Make videos as “non-interactive” as possible (clean)
  document.addEventListener("DOMContentLoaded", () => {
    $$("video.media--video").forEach(v => {
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

      // Try play (some browsers need a nudge)
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    });
  });

  // chapters
  const chapters = $$("[data-chapter]").map(sec => {
    const sticky = sec.querySelector("[data-sticky]");
    const visual = sec.querySelector("[data-visual]");
    const frame  = sec.querySelector("[data-frame]");
    const win    = sec.querySelector("[data-window]");
    const copy   = sec.querySelector(".chapter__copy");
    const overlay= sec.querySelector(".chapter__overlay");
    const scroll = sec.querySelector(".scroll");
    return { sec, sticky, visual, frame, win, copy, overlay, scroll };
  }).filter(x => x.sticky && x.visual && x.frame && x.win);

  let ticking = false;

  function updateChapter(c){
    if (prefersReduced) return;

    const { sec, sticky, visual, frame, win, copy, overlay, scroll } = c;

    // progress in this chapter
    const total = sec.offsetHeight - sticky.offsetHeight;
    const scrolled = clamp(window.scrollY - sec.offsetTop, 0, total);
    const p = total > 0 ? scrolled / total : 0; // 0..1

    // timings (Apple-like: copy fades, frame appears, media fits)
    const copyStart = 0.08, copyEnd = 0.28;
    const frameStart = 0.18, frameEnd = 0.42;
    const fitStart = 0.16, fitEnd = 0.78;
    const tossStart = 0.86, tossEnd = 1.00;

    // copy fade
    if (copy){
      const t = clamp((p - copyStart) / (copyEnd - copyStart), 0, 1);
      const e = ease(t);
      copy.style.opacity = String(1 - e);
      copy.style.transform = `translate3d(0, ${-18 * e}px, 0)`;
      copy.style.filter = `blur(${2.2 * e}px)`;
      copy.style.pointerEvents = e > 0.85 ? "none" : "auto";
    }

    // overlay slightly lowers to reveal media “pure”
    if (overlay){
      const t = clamp((p - 0.10) / 0.50, 0, 1);
      overlay.style.opacity = String(lerp(1, 0.58, ease(t)));
    }

    // scroll hint fade
    if (scroll){
      const t = clamp((p - 0.12) / 0.22, 0, 1);
      scroll.style.opacity = String(1 - t);
    }

    // frame reveal
    const frameOpacity = clamp((p - frameStart) / (frameEnd - frameStart), 0, 1);
    frame.style.opacity = String(frameOpacity);

    // FIT media (fullscreen -> frame window)
    const tFit = clamp((p - fitStart) / (fitEnd - fitStart), 0, 1);
    const eFit = ease(tFit);

    const end = win.getBoundingClientRect();

    // Start rect = viewport (stable, no weird “jump”)
    const vw = window.innerWidth;
    const vh = window.innerHeight - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--navH")) || 64);

    const startW = vw;
    const startH = vh;
    const startCx = vw / 2;
    const startCy = (vh / 2) + (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--navH")) || 64);

    const endCx = end.left + end.width / 2;
    const endCy = end.top + end.height / 2;

    const dx = (endCx - startCx) * eFit;
    const dy = (endCy - startCy) * eFit;

    const sx = end.width / startW;
    const sy = end.height / startH;
    const sTarget = Math.min(sx, sy);
    const scale = lerp(1, sTarget, eFit);

    // subtle polish (avoid heavy blur for perf)
    const op = lerp(1, 0.94, eFit);
    visual.style.opacity = String(op);
    visual.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${scale})`;

    // frame settle (tiny)
    const settle = ease(clamp((p - 0.30) / 0.55, 0, 1));
    const fScale = lerp(0.94, 1, settle);
    frame.style.transform = `translate3d(-50%, -46%, 0) scale(${fScale})`;

    // “Page toss” at end: frame drifts away (very premium)
    // (nur bei Chapter 01 + 03; Chapter 02 bleibt clean)
    if (sec.classList.contains("chapter--video")){
      const tToss = clamp((p - tossStart) / (tossEnd - tossStart), 0, 1);
      const eToss = ease(tToss);

      const rot = lerp(0, -9, eToss);
      const tx  = lerp(0, -140, eToss);
      const ty  = lerp(0, -220, eToss);
      const fade = lerp(1, 0, eToss);

      // multiply with frameOpacity so it doesn't pop
      frame.style.opacity = String(frameOpacity * fade);
      frame.style.transform =
        `translate3d(calc(-50% + ${tx}px), calc(-46% + ${ty}px), 0) rotate(${rot}deg) scale(${fScale})`;

      // keep media alive but calmer
      visual.style.opacity = String(lerp(op, 0.72, eToss));
    }
  }

  function update(){
    ticking = false;
    for (const c of chapters) updateChapter(c);
  }

  function requestTick(){
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  window.addEventListener("scroll", requestTick, { passive:true });
  window.addEventListener("resize", requestTick, { passive:true });

  // When video metadata loads, recalc (prevents odd sizing)
  $$("video.media--video").forEach(v => {
    v.addEventListener("loadedmetadata", () => requestTick(), { once:true });
  });

  update();
})();
