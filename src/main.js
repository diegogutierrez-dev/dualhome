import './style.css';
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import { World } from './gl/world.js';

gsap.registerPlugin(ScrollTrigger, SplitText);
// mobile URL-bar show/hide fires resize while scrolling; don't recalculate triggers for it
ScrollTrigger.config({ ignoreMobileResize: true });

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = window.matchMedia('(max-width: 760px), (pointer: coarse)').matches;

document.body.classList.add('is-loading');

/* ---------------- Smooth scroll ---------------- */
// syncTouch drives touch scrolling from the same frame as the WebGL render, so the canvas
// and the DOM move together instead of the canvas lagging a frame behind native scroll.
const lenis = reduced ? null : new Lenis({ lerp: 0.085, smoothWheel: true, syncTouch: isMobile, syncTouchLerp: 0.1, touchMultiplier: 1 });
if (lenis) {
  lenis.stop();
  lenis.on('scroll', ScrollTrigger.update);
}

/* ---------------- WebGL ---------------- */
let loaded = 0;
let assetsDone = false;
const manager = new THREE.LoadingManager(
  () => { loaded = 1; assetsDone = true; },
  (_url, done, total) => (loaded = done / total),
  () => {}
);
let world = null;
try {
  world = new World({ canvas: $('[data-webgl]'), isMobile, reduced, manager });
  $$('[data-anchor]').forEach((el) => world.addAnchor(el, el.dataset.anchor));
  $$('[data-drag-zone]').forEach((el) => world.bindDrag(el));
  $$('img[data-gl]').forEach((img) => (img._gl = world.media.add(img)));
  document.documentElement.classList.add('gl-ready');
  if (import.meta.env.DEV) Object.assign(window, { __world: world, __lenis: lenis });
} catch (err) {
  console.warn('WebGL unavailable, falling back to static images', err);
  $$('[data-anchor]').forEach((el) => {
    const img = new Image();
    img.src = '/assets/puf-touch.webp';
    img.alt = 'Puf Dual';
    img.style.cssText = 'width:min(80%,420px);margin:auto;position:absolute;inset:0;border-radius:24px;object-fit:contain';
    el.appendChild(img);
  });
}

/* ---------------- Loader ---------------- */
const bar = $('[data-loader-bar]');
const count = $('[data-loader-count]');
const progress = { v: 0 };
function waitAssets() {
  const start = performance.now();
  return new Promise((resolve) => {
    // poll instead of relying on a single callback; never hold the page hostage
    const check = () => (!world || assetsDone || performance.now() - start > 6000 ? resolve() : setTimeout(check, 50));
    check();
  });
}

const loaderTick = () => {
  progress.v += (loaded - progress.v) * 0.12;
  bar.style.transform = `scaleX(${progress.v})`;
  count.textContent = Math.round(progress.v * 100);
};
gsap.ticker.add(loaderTick);

Promise.all([waitAssets(), document.fonts.ready]).then(() => {
  loaded = 1;
  gsap.delayedCall(0.5, () => {
    gsap.ticker.remove(loaderTick);
    bar.style.transform = 'scaleX(1)';
    count.textContent = '100';
    initAnimations();
    intro();
  });
});

/* ---------------- Render loop ---------------- */
gsap.ticker.add((time, deltaMs) => {
  if (lenis) lenis.raf(time * 1000);
  if (!world) return;
  world.scroll = lenis ? lenis.scroll : window.scrollY;
  world.vel = lenis ? lenis.velocity : 0;
  world.update(Math.min(deltaMs / 1000, 0.05));
});
gsap.ticker.lagSmoothing(0);

let rw = window.innerWidth;
window.addEventListener('resize', () => {
  world?.resize();
  // mobile URL-bar resizes change only height; avoid re-splitting text for those
  if (Math.abs(window.innerWidth - rw) > 2) {
    rw = window.innerWidth;
    ScrollTrigger.refresh();
  }
});

/* ---------------- Intro ---------------- */
function intro() {
  const tl = gsap.timeline({
    defaults: { ease: 'expo.out' },
    onComplete: () => {
      document.body.classList.remove('is-loading');
      lenis?.start();
    },
  });
  const title = new SplitText('[data-hero-title]', { type: 'lines,chars', mask: 'lines' });
  padMasks(title);
  tl.to('[data-loader]', { clipPath: 'inset(0 0 100% 0)', duration: 1.2, ease: 'expo.inOut' })
    .set('[data-loader]', { display: 'none' })
    .from('.hero__blob', { scale: 0.6, opacity: 0, duration: 1.8 }, '-=0.6')
    .from(title.chars, { yPercent: 110, rotate: 6, duration: 1.4, stagger: 0.035 }, '<0.1')
    .from(['[data-hero-eyebrow]', '[data-hero-lead]', '[data-hero-actions]'], { y: 30, opacity: 0, duration: 1.2, stagger: 0.1 }, '<0.3')
    .from('[data-hero-script]', { opacity: 0, rotate: -20, x: 30, duration: 1.4 }, '<0.2')
    .from('.nav', { yPercent: -100, opacity: 0, duration: 1 }, '<')
    .to(world ? world : {}, { intro: 1, duration: 2.2, ease: 'expo.out' }, 1.0)
    .from(world ? world : {}, { drag: -Math.PI * 1.2, duration: 2.6, ease: 'expo.out' }, 1.0);
}

/* ---------------- Scroll animations ---------------- */
// Line masks clip overflow; give descenders (g, j, p) and accents room so they aren't cut.
function padMasks(split) {
  (split.masks || []).forEach((m) => {
    m.style.padding = '0.12em 0.04em 0.22em';
    m.style.margin = '-0.12em -0.04em -0.22em';
  });
}

function initAnimations() {
  // split headings, masked line reveals
  $$('[data-split]').forEach((el) => {
    const split = new SplitText(el, { type: 'lines', mask: 'lines', linesClass: 'line' });
    padMasks(split);
    gsap.from(split.lines, {
      yPercent: 105,
      duration: 1.4,
      ease: 'expo.out',
      stagger: 0.09,
      scrollTrigger: { trigger: el, start: 'top 85%' },
    });
  });

  ScrollTrigger.batch('[data-fade]', {
    start: 'top 88%',
    onEnter: (els) => gsap.fromTo(els, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 1.2, ease: 'expo.out', stagger: 0.08, overwrite: true }),
  });
  gsap.set('[data-fade]', { opacity: 0 });

  // painted images: brush-reveal when they enter
  $$('img[data-gl]').forEach((img) => {
    const u = img._gl?.mat.uniforms.uReveal;
    if (!u) return;
    ScrollTrigger.create({
      trigger: img,
      start: 'top 92%',
      once: true,
      onEnter: () => gsap.to(u, { value: 1, duration: reduced ? 0.01 : 2.2, ease: 'power2.out' }),
    });
  });

  // manifesto dogs drift (parallax)
  gsap.to('.manifesto__dog--a', { yPercent: -18, ease: 'none', scrollTrigger: { trigger: '.manifesto', scrub: true } });
  gsap.to('.manifesto__dog--b', { yPercent: 14, ease: 'none', scrollTrigger: { trigger: '.manifesto', scrub: true } });
  gsap.to('.hero__blob', { yPercent: 30, scale: 1.1, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

  homesGrid();
  productStory();
  configurator();
  nav();
  menu();
  form();
  links();

  gsap.from('.footer__big', { yPercent: 40, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'bottom bottom', scrub: true } });
  ScrollTrigger.refresh();
}

function homesGrid() {
  const grid = $('[data-homes]');
  const dots = Array.from({ length: 100 }, () => grid.appendChild(document.createElement('i')));
  const counter = $('[data-count]');
  const st = { n: 0 };
  gsap.timeline({ scrollTrigger: { trigger: '.data__viz', start: 'top 75%' } })
    .to(st, {
      n: 57,
      duration: 2.6,
      ease: 'power3.inOut',
      onUpdate: () => {
        const n = Math.round(st.n);
        counter.textContent = n;
        dots.forEach((d, i) => {
          d.classList.toggle('on', i < n);
          d.classList.toggle('was', i < Math.min(n, 38));
        });
      },
    })
    .fromTo(dots, { scale: 0.2 }, { scale: 0.7, duration: 0.8, ease: 'back.out(3)', stagger: { each: 0.01, grid: [5, 20], from: 'start' } }, 0);
}

function productStory() {
  const steps = $$('[data-pstep]');
  const s = world?.story ?? {};
  gsap.set(steps[0], { autoAlpha: 1 });
  const tl = gsap.timeline({
    defaults: { ease: 'power2.inOut' },
    scrollTrigger: { trigger: '.product', start: 'top top', end: 'bottom bottom', scrub: 1.2 },
  });
  const show = (i, at) => {
    tl.to(steps[i - 1], { autoAlpha: 0, y: -30, duration: 0.25 }, at);
    tl.fromTo(steps[i], { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.3 }, at + 0.2);
  };
  // 0 → conventional puf seen from the back
  tl.to(s, { rotY: Math.PI - 0.95, tilt: 0.34, duration: 1 }, 0);
  // 1 → human zone: lower angle, cushion focus
  show(1, 0.9);
  tl.to(s, { rotY: Math.PI * 0.5 + 0.2, tilt: 0.42, duration: 1 }, 1);
  // 2 → WOW: turn to the arch, light the refuge, the dog appears
  show(2, 1.9);
  tl.to(s, { rotY: 0.26, tilt: 0.14, duration: 1.2 }, 2);
  tl.to(s, { glow: 1, duration: 0.5 }, 2.6);
  tl.to(s, { dog: 1, duration: 0.6, ease: 'back.out(1.6)' }, 2.7);
  // 3 → exploded / repairable
  show(3, 3.4);
  tl.to(s, { explode: 1, rotY: 0.85, tilt: 0.3, duration: 1, ease: 'power3.inOut' }, 3.5);
  tl.to(s, { dog: 0, duration: 0.3 }, 3.5);
  tl.to({}, { duration: 0.4 }, 4.5);
  tl.to('[data-product-bar]', { scaleX: 1, ease: 'none', duration: tl.duration() }, 0);
}

function configurator() {
  const set = (attr, label, fn) => {
    const btns = $$(`[data-${attr}]`);
    btns.forEach((b) =>
      b.addEventListener('click', () => {
        btns.forEach((o) => { o.classList.toggle('is-active', o === b); o.setAttribute('aria-checked', o === b); });
        $(`[data-${label}]`).textContent = b.dataset.name;
        if (!world) return;
        const mat = attr === 'fabric' ? world.puf.fabric : world.puf.wood;
        const to = new THREE.Color(b.dataset[attr]);
        gsap.to(mat.color, { r: to.r, g: to.g, b: to.b, duration: 0.9, ease: 'power2.out' });
        world.dragVel += 0.06; // a small nudge so the change is felt
        fn?.();
      })
    );
  };
  set('fabric', 'fabric-name');
  set('wood', 'wood-name');

  const toggle = (sel, apply) => {
    const b = $(sel);
    b.addEventListener('click', () => {
      const on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', on);
      if (world) apply(on);
    });
  };
  toggle('[data-explode]', (on) => gsap.to(world.user, { explode: on ? 1 : 0, duration: 1.2, ease: 'expo.inOut' }));
  toggle('[data-glow]', (on) => {
    gsap.to(world.user, { glow: on ? 1 : 0, dog: on ? 1 : 0, duration: 1, ease: 'power3.out' });
    if (on) gsap.to(world, { drag: Math.round(world.drag / (Math.PI * 2)) * Math.PI * 2 + 0.55 - world.user.rotY, duration: 1.4, ease: 'expo.inOut' });
  });
}

function nav() {
  const navEl = $('[data-nav]');
  let last = 0;
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => {
      const y = self.scroll();
      navEl.classList.toggle('is-solid', y > 60);
      if (!document.body.classList.contains('menu-open')) navEl.classList.toggle('is-hidden', y > last && y > 400);
      last = y;
    },
  });
}

function menu() {
  const btn = $('[data-burger]');
  const m = $('[data-menu]');
  const linksEls = $$('[data-menu-link]');
  let open = false;
  const tl = gsap.timeline({ paused: true })
    .set(m, { visibility: 'visible' })
    .to(m, { clipPath: 'inset(0 0 0% 0)', duration: 0.9, ease: 'expo.inOut' })
    .from(linksEls, { yPercent: 100, opacity: 0, duration: 0.8, stagger: 0.05, ease: 'expo.out' }, '-=0.4');
  const setOpen = (v) => {
    open = v;
    btn.setAttribute('aria-expanded', v);
    btn.setAttribute('aria-label', v ? 'Cerrar menú' : 'Abrir menú');
    document.body.classList.toggle('menu-open', v);
    if (v) { tl.play(); lenis?.stop(); } else { tl.reverse(); lenis?.start(); }
  };
  btn.addEventListener('click', () => setOpen(!open));
  linksEls.forEach((a) => a.addEventListener('click', () => setOpen(false)));
  window.addEventListener('keydown', (e) => e.key === 'Escape' && open && setOpen(false));
}

function links() {
  $$('a[href^="#"]').forEach((a) =>
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      const target = id.length > 1 && $(id);
      if (!target) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { duration: 1.6, offset: id === '#producto' || id === '#inicio' ? 0 : -40 });
      else target.scrollIntoView();
    })
  );
}

function form() {
  const f = $('[data-form]');
  const ok = $('[data-form-ok]');
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    let valid = true;
    ['name', 'email'].forEach((n) => {
      const input = f.elements[n];
      const bad = !input.value.trim() || (n === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value));
      input.setAttribute('aria-invalid', bad);
      if (bad) valid = false;
    });
    if (!valid) {
      gsap.fromTo(f, { x: -8 }, { x: 0, duration: 0.6, ease: 'elastic.out(1, 0.3)' });
      return;
    }
    gsap.to(f.querySelectorAll('.form__field, .form__pets, button'), {
      opacity: 0, y: -10, stagger: 0.05, duration: 0.4,
      onComplete: () => {
        f.querySelectorAll('.form__field, .form__pets, button').forEach((el) => (el.style.display = 'none'));
        ok.hidden = false;
        gsap.from(ok, { y: 20, opacity: 0, duration: 1, ease: 'expo.out' });
      },
    });
  });
}

