/**
 * Android TV mode: 10-foot UI plus D-pad spatial navigation.
 *
 * Turned on automatically when the Android app runs on a TV (web/src/native/android.ts), by VITE_TV=1 at build
 * time, or by opening the app with ?tv=1 (handy for trying it in a browser). Everywhere else it stays off.
 *
 * Rules: geometry in document space (rails stay navigable when an item is scrolled out), candidates
 * overlapping the current element on the other axis win, every scrollable ancestor is scrolled
 * just enough to reveal the target, and key auto-repeat is throttled so a held arrow moves one step.
 */

const FOCUSABLE = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled]):not([type='hidden']):not([type='file']):not([type='color'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
  '[role="button"]',
  '[role="switch"]',
  '[role="radio"]',
  '[role="checkbox"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="slider"]',
  "[data-tv-focusable]",
].join(",");

const REPEAT_MS = 90;
let lastMove = 0;

export function isTvMode(): boolean {
  if (typeof window === "undefined") return false;
  if (new URLSearchParams(window.location.search).has("tv")) return true;
  if (import.meta.env.VITE_TV === "1") return true;
  return document.documentElement.dataset.tv === "1";
}

function shown(el: HTMLElement): boolean {
  const style = getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
  const r = el.getBoundingClientRect();
  return r.width >= 4 && r.height >= 4;
}

/** On screen, even while still transparent: dialogs open with a fade-in, and must count from the first frame. */
function present(el: HTMLElement): boolean {
  const style = getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;
  const r = el.getBoundingClientRect();
  return r.width >= 4 && r.height >= 4;
}

/** The topmost open dialog, sheet or menu, if any. While one is open the D-pad stays inside it. */
function activeDialog(): HTMLElement | null {
  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>('[role="dialog"], [aria-modal="true"], dialog[open], [role="menu"]'),
  ).filter(present);
  return nodes.length ? nodes[nodes.length - 1] : null;
}

function focusables(scope: ParentNode = activeDialog() ?? document): HTMLElement[] {
  return Array.from(scope.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(shown);
}

function isTextInput(el: HTMLElement | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (!el) return false;
  if (el.isContentEditable) return true;
  if (el instanceof HTMLTextAreaElement) return !el.readOnly;
  return el instanceof HTMLInputElement && !el.readOnly && /^(text|search|email|password|url|tel)$/.test(el.type);
}

function box(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return {
    left: r.left + window.scrollX,
    top: r.top + window.scrollY,
    width: r.width,
    height: r.height,
    cx: r.left + window.scrollX + r.width / 2,
    cy: r.top + window.scrollY + r.height / 2,
  };
}

function scrollableAncestors(el: HTMLElement): HTMLElement[] {
  const result: HTMLElement[] = [];
  let node = el.parentElement;
  while (node && node !== document.body) {
    const s = getComputedStyle(node);
    const canY = /(auto|scroll|overlay)/.test(s.overflowY) && node.scrollHeight > node.clientHeight + 4;
    const canX = /(auto|scroll|overlay)/.test(s.overflowX) && node.scrollWidth > node.clientWidth + 4;
    if (canX || canY) result.push(node);
    node = node.parentElement;
  }
  return result;
}

function reveal(el: HTMLElement) {
  const scrollers = scrollableAncestors(el);
  if (!scrollers.length) {
    el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    return;
  }
  for (const scroller of scrollers) {
    const s = scroller.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const style = getComputedStyle(scroller);
    const canY = /(auto|scroll|overlay)/.test(style.overflowY) && scroller.scrollHeight > scroller.clientHeight + 4;
    const canX = /(auto|scroll|overlay)/.test(style.overflowX) && scroller.scrollWidth > scroller.clientWidth + 4;
    const marginX = 36;
    const marginTop = scroller.tagName === "MAIN" ? 84 : 36;
    const marginBottom = 36;
    let dx = 0;
    let dy = 0;
    if (canX) {
      if (r.left < s.left + marginX) dx = r.left - s.left - marginX;
      else if (r.right > s.right - marginX) dx = r.right - s.right + marginX;
    }
    if (canY) {
      if (r.top < s.top + marginTop) dy = r.top - s.top - marginTop;
      else if (r.bottom > s.bottom - marginBottom) dy = r.bottom - s.bottom + marginBottom;
    }
    if (dx || dy) scroller.scrollBy({ left: dx, top: dy, behavior: "smooth" });
  }
}

function move(direction: "left" | "right" | "up" | "down"): boolean {
  const current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const from = current && shown(current) ? box(current) : null;
  const horizontal = direction === "left" || direction === "right";
  let best: HTMLElement | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const el of focusables()) {
    if (el === current) continue;
    const to = box(el);
    const primary = !from
      ? (horizontal ? to.cx : to.cy)
      : horizontal
        ? direction === "right"
          ? to.left - (from.left + from.width)
          : from.left - (to.left + to.width)
        : direction === "down"
          ? to.top - (from.top + from.height)
          : from.top - (to.top + to.height);
    if (primary < -2) continue;

    let perp = 0;
    let overlap = 0;
    if (from) {
      const a1 = horizontal ? from.top : from.left;
      const a2 = horizontal ? from.top + from.height : from.left + from.width;
      const b1 = horizontal ? to.top : to.left;
      const b2 = horizontal ? to.top + to.height : to.left + to.width;
      overlap = Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
      perp = Math.abs((horizontal ? to.cy : to.cx) - (horizontal ? from.cy : from.cx));
    }

    const score = Math.max(primary, 0) + (overlap > 0 ? perp * 0.35 : perp * 2.6 + 400);
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }

  if (!best) return false;
  best.focus({ preventScroll: true });
  reveal(best);
  return true;
}

function activate(): boolean {
  const el = document.activeElement;
  if (!(el instanceof HTMLElement) || el === document.body) return false;
  if (isTextInput(el)) return false;
  el.click();
  return true;
}

function pickInitialTarget(scope?: ParentNode): HTMLElement | null {
  if (scope) {
    const els = focusables(scope);
    if (!els.length) return null;
    // Prefer an autofocus input, or skip the header close-X button when the dialog has real controls.
    const auto = els.find((e) => e.hasAttribute("autofocus"));
    if (auto) return auto;
    if (els.length > 1 && els[0].closest("[role='dialog']") && /close|fechar/i.test(els[0].getAttribute("aria-label") ?? "")) {
      return els[1];
    }
    return els[0];
  }
  const main = document.querySelector("main");
  if (main) {
    const mainEls = focusables(main);
    if (mainEls.length) return mainEls[0];
  }
  return focusables()[0] ?? null;
}

let lastOutside: HTMLElement | null = null;

/** Focus the first control of a freshly opened dialog, put focus back when it closes, and recover lost focus. */
function watchDialogs() {
  let current: HTMLElement | null = null;
  let recoveryRaf = 0;

  const scheduleRecovery = () => {
    if (recoveryRaf) return;
    recoveryRaf = requestAnimationFrame(() => {
      recoveryRaf = 0;
      const dialog = activeDialog();
      const active = document.activeElement;
      if (dialog) {
        if (!(active instanceof HTMLElement) || !dialog.contains(active) || !shown(active)) {
          const target = pickInitialTarget(dialog);
          if (target) target.focus({ preventScroll: true });
        }
        return;
      }
      if (!active || active === document.body || !(active instanceof HTMLElement) || !document.contains(active)) {
        const target = pickInitialTarget();
        if (target) target.focus({ preventScroll: true });
      }
    });
  };

  const sync = () => {
    const dialog = activeDialog();
    if (dialog !== current) {
      if (dialog) {
        lastOutside = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        current = dialog;
        requestAnimationFrame(() => {
          const target = pickInitialTarget(dialog);
          if (target) target.focus({ preventScroll: true });
        });
      } else {
        current = null;
        if (lastOutside && document.contains(lastOutside) && shown(lastOutside)) {
          lastOutside.focus({ preventScroll: true });
        } else {
          scheduleRecovery();
        }
        lastOutside = null;
      }
      return;
    }
    scheduleRecovery();
  };

  new MutationObserver(sync).observe(document.body, { childList: true, subtree: true });
  sync();
}

let installed = false;

export function installTvMode() {
  if (installed || !isTvMode()) return;
  installed = true;
  document.documentElement.dataset.tv = "1";

  window.addEventListener(
    "keydown",
    (event) => {
      const target = event.target as HTMLElement | null;
      const inText = isTextInput(target);
      const inSelect = target instanceof HTMLSelectElement;
      const inSlider = target instanceof HTMLElement && target.getAttribute("role") === "slider";
      const key = event.key;
      const handled = () => {
        event.preventDefault();
        event.stopPropagation();
      };

      if (key === "ArrowLeft" || key === "ArrowRight" || key === "ArrowUp" || key === "ArrowDown") {
        if (inSelect) return;

        // Sliders (scrubber / volume): Left & Right adjust the slider; Up & Down always escape spatially.
        if (inSlider && (key === "ArrowLeft" || key === "ArrowRight")) return;

        // Text inputs: Up/Down always escape single-line inputs; Left/Right escape at text boundaries.
        if (inText) {
          if (target instanceof HTMLTextAreaElement || target.isContentEditable) return;
          if (key === "ArrowLeft") {
            const start = target.selectionStart ?? 0;
            const end = target.selectionEnd ?? 0;
            if (start > 0 || end > 0) return;
          } else if (key === "ArrowRight") {
            const len = target.value.length;
            const start = target.selectionStart ?? len;
            const end = target.selectionEnd ?? len;
            if (start < len || end < len) return;
          }
        }

        const now = performance.now();
        if (event.repeat && now - lastMove < REPEAT_MS) {
          handled();
          return;
        }
        lastMove = now;
        if (move(key.replace("Arrow", "").toLowerCase() as "left" | "right" | "up" | "down")) handled();
        return;
      }

      if (key === "Escape" || key === "BrowserBack" || key === "GoBack") {
        // A dialog or a menu is open: the app's own Escape handler closes it (and nothing else).
        const overlay = [...document.querySelectorAll<HTMLElement>("[data-escape-closes]")].some(present);
        if (activeDialog() || overlay) return;
        if (window.history.length > 1) {
          handled();
          window.history.back();
        }
        return;
      }

      if ((key === "Enter" || key === " ") && !inText && !inSelect) {
        const active = document.activeElement;
        if (key === "Enter" && (active instanceof HTMLButtonElement || active instanceof HTMLAnchorElement)) return;
        if (key === " " && active instanceof HTMLButtonElement) return;
        if (activate()) handled();
      }
    },
    { capture: true },
  );

  watchDialogs();

  const focusFirst = () => {
    if (document.activeElement === document.body) {
      const target = pickInitialTarget();
      if (target) target.focus({ preventScroll: true });
    }
  };
  window.setTimeout(focusFirst, 350);
}
