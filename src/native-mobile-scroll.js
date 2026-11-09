// Mobile has one native document scroller. This module observes its absolute
// position; it never cancels a gesture or synthesizes velocity/momentum.
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number.isNaN(Number(value)) ? min : Number(value)));

export function buildNativeScrollRoute({edges, stageHeight, contentHeight, overflows = []}) {
  if (!Array.isArray(edges) || edges.length < 2 || edges[0] !== 0 || edges.at(-1) !== 1 ||
      edges.some((edge, i) => !Number.isFinite(edge) || (i && edge <= edges[i - 1]))) {
    throw new Error('Native scroll route needs increasing chapter edges from zero to one.');
  }
  const finiteSize = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
  const stage = Math.max(1, finiteSize(stageHeight));
  const viewport = Math.max(1, finiteSize(contentHeight));
  let total = 0;
  const segments = edges.slice(0, -1).map((lo, index) => {
    const hi = edges[index + 1];
    const overflow = index ? finiteSize(overflows[index]) : 0;
    const runway = index ? Math.min(180, viewport * .5) : 0;
    const travel = index ? stage * .65 : 0;
    const length = travel + Math.max(overflow + runway, stage * (index ? .65 : .8));
    const segment = {index, lo, hi, start: total, end: total + length, length, overflow, runway, travel};
    total += length;
    return segment;
  });
  return {segments, total, stageHeight: stage, contentHeight: viewport};
}

export function nativeScrollStateAt(route, offset) {
  const y = clamp(offset, 0, route.total);
  const segment = route.segments.find(s => y < s.end) || route.segments.at(-1);
  const local = clamp(y - segment.start, 0, segment.length);
  return {
    index: segment.index,
    progress: segment.lo + (segment.hi - segment.lo) * local / segment.length,
    // Long text follows native pixels 1:1; shorter text uses its whole reading
    // interval. The final runway keeps the last item visible before changing.
    panelTop: segment.overflow * Math.min(1, Math.max(0,local - segment.travel) / Math.max(1, segment.length - segment.travel - segment.runway)),
  };
}

export function nativeScrollOffsetFor(route, progress, index = null) {
  if (index !== null) return route.segments[clamp(Math.trunc(index), 0, route.segments.length - 1)].start;
  const p = clamp(progress, 0, 1);
  const segment = route.segments.find(s => p < s.hi) || route.segments.at(-1);
  return segment.start + segment.length * (p - segment.lo) / (segment.hi - segment.lo);
}

export function createNativeMobileScroll({app, panel, content, chapters, edges, onInput}) {
  const doc = app?.ownerDocument || globalThis.document;
  const win = doc?.defaultView || globalThis.window;
  if (!doc?.body || !doc.documentElement?.classList || !doc.createElement || !win?.addEventListener ||
      !win.scrollTo || !win.getComputedStyle || !app || !panel || !content || typeof onInput !== 'function') {
    throw new Error('Native mobile scrolling requires a browser document and mounted experience elements.');
  }
  if (chapters.length !== edges.length - 1) throw new Error('Native scroll chapters and edges must match.');

  const root = doc.documentElement;
  const hadNativeClass = root.classList.contains('native-mobile');
  let route, latest = 0, dirty = true, scrolling = false, destroyed = false;
  let locked = false, requestedLock = false, lockedOffset = 0, ignoredOffset = null;
  let endTimer = null, measureTimer = null, needsMeasure = false;
  let mutationObserver = null, resizeObserver = null;
  let historyOwner = null, previousRestoration, ownsRestoration = false;
  const oldLockY = root.style.getPropertyValue('--native-scroll-lock-y');
  const oldLockPriority = root.style.getPropertyPriority?.('--native-scroll-lock-y') || '';
  const spacer = doc.createElement('div');
  spacer.id = 'native-scroll-spacer';
  spacer.className = 'native-scroll-spacer';
  spacer.setAttribute('aria-hidden', 'true');
  spacer.inert = true;
  spacer.style.cssText = 'width:1px;pointer-events:none;overflow-anchor:none;';

  const notify = () => { if (!destroyed) onInput(); };
  const rawOffset = () => Number(win.scrollY ?? win.pageYOffset ?? root.scrollTop) || 0;
  const readOffset = () => clamp(rawOffset(), 0, route.total);
  const jump = y => win.scrollTo({left: 0, top: y, behavior: 'instant'});
  const clearEndTimer = () => { if (endTimer !== null) win.clearTimeout(endTimer); endTimer = null; };
  const geometry = () => {
    const stageHeight = Math.max(1, app.clientHeight || win.innerHeight || 1);
    const panelWidth = panel.getBoundingClientRect().width || app.clientWidth * .9;
    const contentWidth = content.getBoundingClientRect().width || Math.max(1, panelWidth - 2);
    const maxHeight = parseFloat(win.getComputedStyle(content).maxHeight);
    const headerHeight = panel.querySelector('.panel-top')?.getBoundingClientRect().height || 43;
    const panelHeight = panel.getBoundingClientRect().height;
    const contentHeight = Number.isFinite(maxHeight) && maxHeight > 0 ? maxHeight :
      Math.max(1, panelHeight > headerHeight ? panelHeight - headerHeight - 2 : content.clientHeight || stageHeight * .35);
    return {stageHeight, contentWidth: Math.max(1, contentWidth), contentHeight};
  };

  function measure() {
    const dimensions = geometry();
    const host = doc.createElement('div');
    host.className = 'native-scroll-measure';
    host.setAttribute('aria-hidden', 'true');
    host.inert = true;
    host.style.cssText = `position:fixed;left:-10000px;top:0;width:${dimensions.contentWidth}px;visibility:hidden;pointer-events:none;contain:layout style;`;
    const probe = content.cloneNode(false);
    probe.removeAttribute('id');
    probe.removeAttribute('tabindex');
    probe.setAttribute('aria-hidden', 'true');
    probe.inert = true;
    probe.style.cssText = `width:${dimensions.contentWidth}px;height:${dimensions.contentHeight}px;min-height:0;max-height:${dimensions.contentHeight}px;overflow:hidden;`;
    host.appendChild(probe);
    doc.body.appendChild(host);
    try {
      const overflows = chapters.map((chapter, index) => {
        if (!index) return 0;
        probe.innerHTML = chapter.body || '';
        // No duplicate document IDs or focusable measurement content.
        probe.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
        const groups = [...probe.querySelectorAll('.portfolio-group')];
        let height = 0;
        if (groups.length) {
          groups.forEach(group => { group.hidden = true; });
          for (const group of groups) {
            group.hidden = false;
            height = Math.max(height, probe.scrollHeight);
            group.hidden = true;
          }
        } else height = probe.scrollHeight;
        return Math.max(0, height - probe.clientHeight);
      });
      return buildNativeScrollRoute({...dimensions, edges, overflows});
    } finally { host.remove(); }
  }

  function syncExtent() {
    // innerHeight may change with browser chrome while the stable svh stage
    // does not. Update only the final spacer extent, not chapter positions.
    spacer.style.height = `${Math.ceil(route.total + (win.innerHeight || root.clientHeight || route.stageHeight))}px`;
  }

  function remeasure() {
    measureTimer = null;
    if (destroyed || !needsMeasure || scrolling || locked || doc.hidden) return;
    needsMeasure = false;
    const state = nativeScrollStateAt(route, latest);
    const oldSegment = route.segments[state.index];
    const fraction = (state.progress - oldSegment.lo) / (oldSegment.hi - oldSegment.lo);
    try {
      const measured = measure();
      route = measured;
      const segment = route.segments[state.index];
      latest = segment.start + segment.length * fraction;
      syncExtent();
      if (Math.abs(rawOffset() - latest) > .5) { ignoredOffset = latest; jump(latest); }
      dirty = true;
      notify();
    } catch (error) {
      // Initial setup errors are thrown. A later size-measurement failure keeps
      // the last usable route instead of breaking the user's active session.
      win.console?.warn?.('Native mobile route kept its previous measurements.', error);
    }
  }

  function requestMeasure() {
    if (destroyed) return;
    needsMeasure = true;
    syncExtent();
    if (measureTimer !== null) win.clearTimeout(measureTimer);
    measureTimer = null;
    if (!scrolling && !locked && !doc.hidden) measureTimer = win.setTimeout(remeasure, 120);
  }

  function endScroll() {
    clearEndTimer();
    if (destroyed) return;
    const wasScrolling = scrolling;
    scrolling = false;
    if (wasScrolling) { dirty = true; notify(); }
    if (needsMeasure) requestMeasure();
  }

  function onScroll() {
    if (destroyed || locked) return;
    const next = readOffset();
    if (ignoredOffset !== null) {
      const ownJump = Math.abs(next - ignoredOffset) < .5;
      ignoredOffset = null;
      if (ownJump) return;
    }
    // Rubber-band overscroll neither reverses the route nor keeps RAF alive.
    if (Math.abs(next - latest) < .00001) return;
    latest = next;
    dirty = true;
    scrolling = true;
    clearEndTimer();
    endTimer = win.setTimeout(endScroll, 180);
    notify();
  }

  function stop() {
    if (destroyed) return;
    clearEndTimer();
    scrolling = false;
    latest = locked ? lockedOffset : readOffset();
    if (!locked) { ignoredOffset = latest; jump(latest); }
    dirty = true;
    notify();
    if (needsMeasure) requestMeasure();
  }

  function syncLock() {
    if (destroyed) return;
    const shouldLock = requestedLock || app.classList.contains('menu-open') || !!doc.querySelector('dialog[open]');
    if (shouldLock === locked) return;
    clearEndTimer();
    scrolling = false;
    if (shouldLock) {
      latest = readOffset();
      lockedOffset = latest;
      ignoredOffset = latest;
      jump(latest);
      locked = true;
      root.style.setProperty('--native-scroll-lock-y', `${-lockedOffset}px`);
      root.classList.add('native-scroll-locked');
    } else {
      root.classList.remove('native-scroll-locked');
      if (oldLockY) root.style.setProperty('--native-scroll-lock-y', oldLockY, oldLockPriority);
      else root.style.removeProperty('--native-scroll-lock-y');
      locked = false;
      latest = lockedOffset;
      ignoredOffset = latest;
      syncExtent();
      jump(latest);
      if (needsMeasure) requestMeasure();
    }
    dirty = true;
    notify();
  }

  function onVisibility() {
    clearEndTimer();
    scrolling = false;
    if (!doc.hidden) {
      if (!locked) latest = readOffset();
      if (needsMeasure) requestMeasure();
    }
    dirty = true;
    notify();
  }

  function claimHistory() {
    // Mobile chapter navigation owns its scroll offset. Do not let a second
    // browser history restoration overwrite the mapped chapter position.
    // Older or restricted embedded browsers may omit or reject this setting.
    try {
      if (win.history && 'scrollRestoration' in win.history) {
        historyOwner = win.history;
        previousRestoration = historyOwner.scrollRestoration;
        historyOwner.scrollRestoration = 'manual';
        ownsRestoration = true;
      }
    } catch { historyOwner = null; }
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    requestedLock = false;
    clearEndTimer();
    if (measureTimer !== null) win.clearTimeout(measureTimer);
    mutationObserver?.disconnect();
    resizeObserver?.disconnect();
    win.removeEventListener?.('scroll', onScroll);
    win.removeEventListener?.('scrollend', endScroll);
    win.removeEventListener?.('resize', requestMeasure);
    doc.removeEventListener?.('visibilitychange', onVisibility);
    if (locked) {
      root.classList.remove('native-scroll-locked');
      if (oldLockY) root.style.setProperty('--native-scroll-lock-y', oldLockY, oldLockPriority);
      else root.style.removeProperty('--native-scroll-lock-y');
    }
    spacer.remove();
    if (!hadNativeClass) root.classList.remove('native-mobile');
    if (ownsRestoration) {
      try { historyOwner.scrollRestoration = previousRestoration; } catch { /* The browser may revoke access during teardown. */ }
      ownsRestoration = false;
    }
    scrolling = false;
    if (locked) { locked = false; try { jump(lockedOffset); } catch { /* The document may already be detached. */ } }
  }

  // Roll back the entire setup, including partial listener/observer setup, if
  // initialization fails. The caller can safely retain the desktop controller.
  try {
    root.classList.add('native-mobile');
    claimHistory();
    route = measure();
    doc.body.appendChild(spacer);
    syncExtent();
    latest = readOffset();
    win.addEventListener('scroll', onScroll, {passive: true});
    win.addEventListener('scrollend', endScroll, {passive: true});
    win.addEventListener('resize', requestMeasure, {passive: true});
    doc.addEventListener('visibilitychange', onVisibility);
    if (win.MutationObserver) {
      mutationObserver = new win.MutationObserver(syncLock);
      mutationObserver.observe(app, {attributes: true, attributeFilter: ['class']});
      mutationObserver.observe(doc.body, {subtree: true, attributes: true, attributeFilter: ['open'], childList: true});
    }
    if (win.ResizeObserver) {
      resizeObserver = new win.ResizeObserver(requestMeasure);
      resizeObserver.observe(app);
    }
    doc.fonts?.ready?.then?.(requestMeasure, () => {});
    syncLock();
  } catch (error) {
    destroy();
    throw error;
  }

  return {
    consume() {
      if (destroyed || !dirty) return null;
      dirty = false;
      return nativeScrollStateAt(route, latest);
    },
    seek(progress, index = null, {smooth = false} = {}) {
      const offset = nativeScrollOffsetFor(route, progress, index);
      const snapshot = nativeScrollStateAt(route, offset);
      if (destroyed) return snapshot;
      clearEndTimer();
      if (locked) {
        lockedOffset = latest = offset;
        root.style.setProperty('--native-scroll-lock-y', `${-offset}px`);
        scrolling = false;
      } else if (smooth && Math.abs(readOffset() - offset) > .5) {
        latest = readOffset();
        ignoredOffset = null;
        scrolling = true;
        win.scrollTo({left: 0, top: offset, behavior: 'smooth'});
        endTimer = win.setTimeout(endScroll, 180);
      } else {
        latest = offset;
        scrolling = false;
        ignoredOffset = offset;
        jump(offset);
      }
      dirty = true;
      notify();
      return snapshot;
    },
    stop,
    setLocked(value) { requestedLock = !!value; syncLock(); },
    get isScrolling() { return scrolling; },
    destroy,
  };
}
