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

  // JS on (fail-safe lookbook)
  document.body.classList.add("js-on");

  // Make videos non-interactive and try autoplay
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

      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    });
  });

  // Lookbook reveal
  const spreads = document.querySelectorAll(".spread");
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting){
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.35 });
  spreads.forEach(s => io.observe(s));

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

    const { sec, sticky, visual, win, copy, overlay, scroll } = c;

    const total = sec.offsetHeight - sticky.offsetHeight;
    const scrolled = clamp(window.scrollY - sec.offsetTop, 0, total);
    const p = total > 0 ? scrolled / total : 0;

    // slower premium timings
    const copyStart = 0.10, copyEnd = 0.42;
    const fitStart  = 0.18, fitEnd  = 0.92;

    // copy fade
    if (copy){
      const t = clamp((p - copyStart) / (copyEnd - copyStart), 0, 1);
      const e = ease(t);
      copy.style.opacity = String(1 - e);
      copy.style.transform = `translate3d(0, ${-18 * e}px, 0)`;
      copy.style.filter = `blur(${2.0 * e}px)`;
      copy.style.pointerEvents = e > 0.85 ? "none" : "auto";
    }

    // overlay stays light
    if (overlay){
      const t = clamp((p - 0.12) / 0.55, 0, 1);
      overlay.style.opacity = String(lerp(0.55, 0.42, ease(t)));
    }

    // scroll hint fades
    if (scroll){
      const t = clamp((p - 0.14) / 0.24, 0, 1);
      scroll.style.opacity = String(1 - t);
    }

    // Fit: viewport -> window rect
    const tFit = clamp((p - fitStart) / (fitEnd - fitStart), 0, 1);
    const eFit = ease(tFit * tFit);

    const end = win.getBoundingClientRect();

    const navH = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--navH")) || 64);
    const vw = window.innerWidth;
    const vh = window.innerHeight - navH;

    const startW = vw;
    const startH = vh;
    const startCx = vw / 2;
    const startCy = (vh / 2) + navH;

    const endCx = end.left + end.width / 2;
    const endCy = end.top + end.height / 2;

    const dx = (endCx - startCx) * eFit;
    const dy = (endCy - startCy) * eFit;

    const sx = end.width / startW;
    const sy = end.height / startH;
    const sTarget = Math.min(sx, sy);
    const scale = lerp(1, sTarget, eFit);

    // subtle premium pop
    const pop = 1 + 0.016 * Math.sin(eFit * Math.PI);
    const finalScale = scale * pop;

    // rounding only as it settles
    const r = lerp(0, 26, ease(clamp((p - 0.30) / 0.52, 0, 1)));
    visual.style.borderRadius = `${r}px`;

    // apply transform
    visual.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${finalScale})`;
    visual.style.opacity = "1";
    visual.style.filter = "none";

  // ===== PAPER CRUMPLE (SAFE, VISIBLE) =====
if (sec.id === "chapter03") {
  const layer = visual.querySelector(".paperLayer");

  const crStart = 0.82;
  const crEnd   = 0.98;
  const tC = clamp((p - crStart) / (crEnd - crStart), 0, 1);
  const eC = ease(tC);

  if (layer) {
    layer.style.opacity = String(lerp(0, 0.18, eC));
    layer.style.transform = `translateY(${lerp(0, -12, eC)}px)`;
  }

  if (tC > 0) {
    const lift = lerp(0, -60, eC);
    const rotX = lerp(0, 10, eC);
    const rotZ = lerp(0, -1.2, eC);

    visual.style.transform =
      `translate3d(${dx}px, ${dy + lift}px, 0)
       scale(${finalScale})
       rotateX(${rotX}deg)
       rotateZ(${rotZ}deg)`;
  }
}


    // micro wobble = realistic paper movement (tiny!)
    const wob = Math.sin(eC * Math.PI * 6) * (1 - eC) * 0.6;

    visual.style.transform =
      `translate3d(${dx + wob}px, ${dy + lift}px, 0) ` +
      `scale(${finalScale}) rotateX(${rotX}deg) rotateZ(${rotZ}deg) ` +
      `scaleX(${squX}) scaleY(${squY})`;

    if (tC > 0.02) console.log("CRUMPLE ACTIVE", tC);
  }
}


    // ✅ Chapter 2: Mobile “cover -> reveal more” (no black bars)
    if (sec.id === "chapter02"){
      const img = visual.querySelector("img");
      if (img){
        img.style.objectFit = "contain"; // reveal possible later
        const startZoom = window.innerWidth <= 980 ? 1.55 : 1.35;
        const endZoom = 1.0;

        const revealT = clamp((p - 0.10) / 0.70, 0, 1);
        const revealE = ease(revealT);

        img.style.transform = `scale(${lerp(startZoom, endZoom, revealE)})`;
      }
    }

    // END BLEND (no empty, no vanish)
    const tOut = clamp((p - 0.88) / 0.12, 0, 1);
    const eOut = ease(tOut);
    if (overlay){
      overlay.style.opacity = String(lerp(0.42, 0.70, eOut));
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

  $$("video.media--video").forEach(v => {
    v.addEventListener("loadedmetadata", () => requestTick(), { once:true });
  });

  update();
})();








