(() => {
  "use strict";

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp  = (a, b, t) => a + (b - a) * t;

  // apple-ish easing (clean)
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

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

  // JS on (lookbook fail-safe)
  document.body.classList.add("js-on");

  // videos: keep clean (no user controls)
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
  const spreads = $$(".spread");
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting){
        // premium stagger
        const i = spreads.indexOf(entry.target);
        setTimeout(() => entry.target.classList.add("is-visible"), i * 90);
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.35 });
  spreads.forEach(s => io.observe(s));

  // Chapters
  const chapters = $$("[data-chapter]").map(sec => {
    const sticky = sec.querySelector("[data-sticky]");
    const visual = sec.querySelector("[data-visual]");
    const win    = sec.querySelector("[data-window]");
    const copy   = sec.querySelector("[data-typo]"); // important for apple motion
    const overlay= sec.querySelector(".chapter__overlay");
    const scroll = sec.querySelector(".scroll");

    // chapter03 paper layers
    const paper  = sec.querySelector(".paperLayer");
    const paperHi= sec.querySelector(".paperHi");

    return { sec, sticky, visual, win, copy, overlay, scroll, paper, paperHi };
  }).filter(x => x.sticky && x.visual && x.win);

  let ticking = false;

  function updateTypo(copyEl, p){
    if (!copyEl) return;

    // clean magazine fade window
    const t = clamp((p - 0.10) / 0.34, 0, 1);
    const e = ease(t);

    // whole block moves up slightly and fades
    copyEl.style.opacity = String(1 - e);
    copyEl.style.transform = `translate3d(0, ${-22 * e}px, 0)`;
    copyEl.style.filter = `blur(${1.6 * e}px)`;

    // “Apple magazine” micro letter-spacing on headlines
    const h = copyEl.querySelector(".h1, .h2");
    if (h){
      const ls = lerp(-0.07, -0.02, e); // subtle
      h.style.letterSpacing = `${ls}em`;
    }

    // lead gets a tiny tracking lift
    const lead = copyEl.querySelector(".lead");
    if (lead){
      const ls2 = lerp(-0.01, 0.02, e);
      lead.style.letterSpacing = `${ls2}em`;
    }
  }

  function updateChapter(c){
    if (prefersReduced) return;

    const { sec, sticky, visual, win, copy, overlay, scroll, paper, paperHi } = c;

    const total = sec.offsetHeight - sticky.offsetHeight;
    const scrolled = clamp(window.scrollY - sec.offsetTop, 0, total);
    const p = total > 0 ? scrolled / total : 0;

    // Apple magazine typography motion
    updateTypo(copy, p);

    // scroll hint fade
    if (scroll){
      const t = clamp((p - 0.14) / 0.24, 0, 1);
      scroll.style.opacity = String(1 - t);
    }

    // overlay breathes
    if (overlay){
      const t = clamp((p - 0.12) / 0.55, 0, 1);
      overlay.style.opacity = String(lerp(0.55, 0.42, ease(t)));
    }

    // Fit: viewport -> window rect (premium slow pacing)
    const fitStart  = 0.18;
    const fitEnd    = 0.92;

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

    const pop = 1 + 0.016 * Math.sin(eFit * Math.PI);
    const finalScale = scale * pop;

    const r = lerp(0, 26, ease(clamp((p - 0.30) / 0.52, 0, 1)));
    visual.style.borderRadius = `${r}px`;

    visual.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${finalScale})`;
    visual.style.opacity = "1";
    visual.style.filter = "none";

    // Chapter 2: cover -> reveal more (mobile friendly)
    if (sec.id === "chapter02"){
      const img = visual.querySelector("img.media--chapter2");
      if (img){
        const startZoom = window.innerWidth <= 980 ? 1.55 : 1.35;
        const endZoom = 1.0;

        const revealT = clamp((p - 0.10) / 0.70, 0, 1);
        const revealE = ease(revealT);

        img.style.transform = `scale(${lerp(startZoom, endZoom, revealE)})`;
      }
    }

    // Chapter 3: paper “magazine crumple” overlay + soft physics exit
    if (sec.id === "chapter03" && paper && paperHi){
      const crStart = 0.82;
      const crEnd   = 0.985;
      const tC = clamp((p - crStart) / (crEnd - crStart), 0, 1);
      const eC = ease(tC);

      // overlay visibility
      paper.style.opacity = String(lerp(0, 0.18, eC));
      paper.style.transform = `translate3d(0, ${lerp(0, -14, eC)}px, 0) rotate(${lerp(0, -1.1, eC)}deg)`;

      paperHi.style.opacity = String(lerp(0, 0.22, eC));

      // physical but not “throw”
      if (tC > 0){
        const lift = lerp(0, -70, eC);
        const rotX = lerp(0, 10, eC);
        const rotZ = lerp(0, -1.6, eC);
        const squX = lerp(1, 0.95, eC);
        const squY = lerp(1, 0.84, eC);

        const wob = Math.sin(eC * Math.PI * 6) * (1 - eC) * 0.6;

        visual.style.transform =
          `translate3d(${dx + wob}px, ${dy + lift}px, 0) ` +
          `scale(${finalScale}) rotateX(${rotX}deg) rotateZ(${rotZ}deg) ` +
          `scaleX(${squX}) scaleY(${squY})`;
      }
    }

    // END BLEND (no empty)
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

  $$("video.media--video").forEach(v => v.addEventListener("loadedmetadata", () => requestTick(), { once:true }));

  update();
})();
