/* ==========================================================================
   Ringus — script.js
   Vanilla JavaScript · no dependencies beyond Lucide (loaded via CDN)

   Load order — both scripts are `defer`red in index.html, so they run in
   document order after parsing and before DOMContentLoaded:
     1. lucide.min.js  → exposes window.lucide
     2. script.js      → this file

   Contents
     1. Bootstrap flags   (.js / .fonts-loaded on <html>)
     2. Icons             (Lucide)
     3. Footer year
     4. Hero video        (hybrid canvas-assisted ping-pong loop)
     5. Init
   ========================================================================== */

(function () {
  'use strict';

  const root = document.documentElement;


  /* 1. Bootstrap flags
     ---------------------------------------------------------------------- */

  /* Progressive-enhancement flag: CSS can target `.js` / `.no-js`. */
  root.classList.remove('no-js');
  root.classList.add('js');

  /* `.fonts-loaded` is added only once Host Grotesk has actually resolved
     (not merely when font loading has settled) — useful for any animation
     that measures text (word masks, split headlines, etc.). If the Google
     Fonts stylesheet is blocked or the face fails, the class stays off. */
  if ('fonts' in document) {
    document.fonts.load('1em "Host Grotesk"')
      .then(function (faces) {
        if (faces.length) {
          root.classList.add('fonts-loaded');
        }
      })
      .catch(function () {
        /* Font unavailable — fallback stack is in use; nothing to do. */
      });
  }


  /* 2. Icons
     ---------------------------------------------------------------------- */

  /**
   * Render Lucide icons.
   * Swaps every `<i data-lucide="name">` for an inline
   * `<svg class="lucide lucide-name">`. Attributes on the placeholder
   * (class, aria-hidden, …) are carried over to the SVG.
   */
  function initIcons() {
    const lucide = window.lucide;

    if (!lucide || typeof lucide.createIcons !== 'function') {
      console.warn('[Ringus] Lucide did not load — icons will not render.');
      return;
    }

    lucide.createIcons();
  }


  /* 3. Footer year
     ---------------------------------------------------------------------- */

  /** Stamp the current year into every `[data-year]` element. */
  function initYear() {
    const year = String(new Date().getFullYear());

    document.querySelectorAll('[data-year]').forEach(function (el) {
      el.textContent = year;
    });
  }


  /* 4. Hero video — hybrid canvas-assisted ping-pong loop
     ----------------------------------------------------------------------
     Forward  : the <video> plays natively. On every animation frame the
                current frame is assigned to a 25 FPS slot (by frame index)
                and, if that slot is empty, cached as a down-scaled
                ImageBitmap via createImageBitmap().
     Reverse  : `reverseLead` seconds before the end the video is paused,
                the <canvas> is revealed on top of it, and the cached
                frames are drawn backwards at 25 FPS. Because the video is
                hidden behind the canvas for this whole phase, it is also
                rewound to 0 *now* — so the turnaround at the end costs
                nothing (see `seekReady`).
     Restart  : at frame 0 the canvas is hidden, playback resumes from the
                already-seeked frame 0, and only then are the bitmaps closed
                (memory released) — keeping the teardown off the critical
                path so the hand-off is a single frame.
     Fallbacks: prefers-reduced-motion → still first frame, engine off.
                No createImageBitmap, clip too long, low-memory device, data
                saver, or cache over budget → the browser's native `loop`
                (also what no-JS gets, since the attribute is left on the
                <video> in the markup).
     Control  : `initHeroVideo` wires a pause/play button so the motion can
                be stopped (WCAG 2.2.2 Pause, Stop, Hide).
     The stage element gets `data-phase` and dispatches a bubbling
     `pingpong:phase` CustomEvent on each transition.

     MEMORY — read before raising `maxCacheBytes`.
     Caching a whole clip uncompressed is inherently expensive: one frame at
     WxH costs W*H*4 bytes, so 8 s at 25 FPS is ~200 frames. `planCapture`
     spends the whole budget, trading resolution for bytes, so the budget is
     the single quality/memory dial. Measured in headless Edge at 1440x900:
     a 384 MB budget produced a 944x530 cache and ~1.2 GB of real process
     growth (bitmaps carry allocator/GPU overhead well beyond the pixel
     maths). The 192 MB default below roughly halves that. Raising it makes
     the reverse phase sharper and the tab heavier — measure before you do.
     ---------------------------------------------------------------------- */

  const PING_PONG = {
    fps: 25,                          // cache + reverse playback rate
    reverseLead: 0.2,                 // seconds before the end to turn around
    maxCaptureWidth: 1280,            // never cache frames wider than this
    maxCacheBytes: cacheBudget(),     // total bytes allowed for cached frames
    maxFrames: 25 * 20,               // beyond 20 s of video, use native loop
  };

  /**
   * Memory budget for the frame cache. 0 means "do not run the engine" —
   * the <video> keeps its native `loop` and costs nothing extra.
   * `navigator.deviceMemory` is Chromium-only and reports a coarse, clamped
   * GB figure; unmeasurable devices are treated as the conservative 4 GB
   * case rather than being handed a desktop-sized cache.
   */
  function cacheBudget() {
    const MB = 1024 * 1024;
    const gb = navigator.deviceMemory;          // undefined in Firefox/Safari
    const conn = navigator.connection;

    if (conn && conn.saveData) return 0;        // data saver → native loop
    if (gb !== undefined && gb < 4) return 0;   // measured low memory → native loop

    const assumed = gb || 4;                    // unmeasurable → 4 GB tier
    return Math.min(192 * MB, assumed * 24 * MB);
  }

  function initHeroVideo() {
    const stage = document.querySelector('[data-hero-video]');
    const video = stage ? stage.querySelector('video') : null;
    const canvas = stage ? stage.querySelector('canvas') : null;
    const toggle = document.querySelector('[data-video-toggle]');

    if (!stage || !video || !canvas) {
      if (toggle) toggle.hidden = true;         // nothing to control
      return;
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const canEngine = typeof window.createImageBitmap === 'function';

    let engine = null;
    let running;

    /** Reflect play/pause state in the button's label and icons. */
    function paint() {
      if (!toggle) return;
      const label = toggle.querySelector('[data-toggle-label]');
      const pauseIcon = toggle.querySelector('[data-toggle-icon="pause"]');
      const playIcon = toggle.querySelector('[data-toggle-icon="play"]');

      if (label) label.textContent = running ? 'Pause background' : 'Play background';
      if (pauseIcon) pauseIcon.hidden = !running;
      if (playIcon) playIcon.hidden = running;
    }

    if (reduced) {
      // Motion is off by default, but the button lets a visitor opt in.
      holdStill(video);
      running = false;
    } else if (canEngine) {
      engine = createPingPongLoop(stage, video, canvas, PING_PONG);
      running = true;
    } else {
      running = true;                           // native `loop` is in charge
    }
    paint();

    if (toggle) {
      toggle.addEventListener('click', function () {
        if (running) {
          if (engine) engine.pause();
          else video.pause();
          running = false;
        } else {
          if (canEngine && !engine) {
            video.autoplay = true;              // undo holdStill
            engine = createPingPongLoop(stage, video, canvas, PING_PONG);
          } else if (engine) {
            engine.resume();
          } else {
            video.loop = true;
            video.play().catch(function () { /* blocked; user can retry */ });
          }
          running = true;
        }
        paint();
      });
    }
  }

  /** Reduced motion: present the first frame as a still instead of motion. */
  function holdStill(video) {
    const freeze = function () {
      video.pause();
      video.loop = false;
      try { video.currentTime = 0; } catch (e) { /* not seekable yet */ }
    };

    video.autoplay = false;
    if (video.readyState >= 1) freeze();
    else video.addEventListener('loadedmetadata', freeze, { once: true });
  }

  function createPingPongLoop(stage, video, canvas, opts) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return null;

    const FRAME_MS = 1000 / opts.fps;
    const RETRY_EVENTS = ['pointerdown', 'keydown', 'touchstart'];

    let phase = 'idle';        // idle | forward | reverse | restarting | disabled
    let frames = [];           // ImageBitmap per 25 FPS slot (null = capture in flight)
    let frameCount = 0;        // slots for this clip
    let cachedCount = 0;
    let firstCached = Infinity;
    let lastCached = -1;
    let generation = 0;        // bumped on release so stale captures are dropped
    let captureW = 0;
    let captureH = 0;
    let rafId = 0;
    let budgetChecked = false;
    let retryArmed = false;
    let paused = false;        // stopped by the visitor via the toggle
    let seekReady = false;     // video already rewound to 0 behind the canvas

    // Reverse-playback cursor. Function-scope (not closed over inside
    // beginReverse) so pause/resume can re-enter the loop mid-phase.
    let revIndex = 0;
    let revStop = 0;
    let revPrevTs = 0;
    let revAcc = 0;

    video.loop = false;        // the engine owns looping from here on
    video.muted = true;        // autoplay policy — belt and braces

    /* -- state ----------------------------------------------------------- */

    function setPhase(next) {
      phase = next;
      stage.dataset.phase = next;
      stage.dispatchEvent(new CustomEvent('pingpong:phase', {
        bubbles: true,
        detail: { phase: next, cached: cachedCount, width: captureW, height: captureH },
      }));
    }

    function cancelRaf() {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    }

    /* -- cache ----------------------------------------------------------- */

    /** Size the cache for this clip and viewport. False = clip unsuitable. */
    function planCapture() {
      if (!opts.maxCacheBytes) return false;    // engine disabled for this device

      const duration = video.duration;
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!isFinite(duration) || duration <= 0 || !vw || !vh) return false;

      frameCount = Math.ceil(duration * opts.fps) + 1;
      if (frameCount > opts.maxFrames) return false;

      // Cache no more pixels than object-fit: cover will display, never
      // wider than maxCaptureWidth, and shrink further until the whole
      // clip fits the byte budget (4 bytes per pixel per frame).
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const coverScale = Math.max((window.innerWidth * dpr) / vw, (window.innerHeight * dpr) / vh);
      const budgetScale = Math.sqrt(opts.maxCacheBytes / (4 * frameCount * vw * vh));
      const scale = Math.min(1, coverScale, opts.maxCaptureWidth / vw, budgetScale);

      captureW = Math.max(2, Math.round((vw * scale) / 2) * 2);
      captureH = Math.max(2, Math.round((vh * scale) / 2) * 2);
      if (canvas.width !== captureW) canvas.width = captureW;
      if (canvas.height !== captureH) canvas.height = captureH;
      return true;
    }

    /** Snapshot the video's current frame into its 25 FPS slot. */
    function captureFrame(time) {
      const index = Math.round(time * opts.fps);
      if (index < 0 || index >= frameCount || frames[index] !== undefined) return;

      frames[index] = null;   // reserve the slot while the bitmap is made
      const gen = generation;

      createImageBitmap(video, {
        resizeWidth: captureW,
        resizeHeight: captureH,
        resizeQuality: 'medium',
      }).then(function (bitmap) {
        if (gen !== generation) {      // cache was released meanwhile
          bitmap.close();
          return;
        }
        if (!budgetChecked) {
          budgetChecked = true;
          // If the browser ignored the resize options, a full-size cache
          // could blow the budget — hand looping back to the browser.
          if (bitmap.width * bitmap.height * 4 * frameCount > opts.maxCacheBytes * 2) {
            bitmap.close();
            disable();
            return;
          }
        }
        frames[index] = bitmap;
        cachedCount += 1;
        if (index < firstCached) firstCached = index;
        if (index > lastCached) lastCached = index;
      }).catch(function () {
        if (gen === generation) frames[index] = undefined;   // allow a retry
      });
    }

    /** Draw the nearest cached frame at or below `index`. */
    function drawFrame(index) {
      let i = Math.min(index, frames.length - 1);
      while (i >= 0 && !frames[i]) i -= 1;
      if (i >= 0) ctx.drawImage(frames[i], 0, 0, canvas.width, canvas.height);
    }

    /** Close every bitmap and forget them. Captures in flight are dropped. */
    function releaseCache() {
      generation += 1;
      for (let i = 0; i < frames.length; i += 1) {
        if (frames[i] && typeof frames[i].close === 'function') frames[i].close();
      }
      frames = [];
      cachedCount = 0;
      firstCached = Infinity;
      lastCached = -1;
    }

    /* -- forward --------------------------------------------------------- */

    function forwardTick() {
      rafId = 0;
      if (phase !== 'forward') return;

      if (!video.paused && !video.seeking && video.readyState >= 2) {
        const t = video.currentTime;
        captureFrame(t);
        if (t >= video.duration - opts.reverseLead) {
          beginReverse();
          return;
        }
      }
      rafId = requestAnimationFrame(forwardTick);
    }

    /* -- reverse --------------------------------------------------------- */

    function onPreSeeked() {
      seekReady = true;
    }

    function beginReverse() {
      if (phase !== 'forward') return;
      cancelRaf();
      video.pause();

      // Reverse only when the cache actually reaches the start of the clip.
      // Nothing cached (tab hidden for the whole pass), or a cache that
      // starts mid-clip, would end the reverse run short of frame 0 and then
      // jump-cut. Fall back to a plain loop for this cycle; the next forward
      // pass starts at 0 and caches from there. A one- or two-frame gap is an
      // invisible 40–80 ms cut, so tolerate that much.
      if (lastCached < 0 || firstCached > 2) {
        restartForward();
        return;
      }

      setPhase('reverse');
      revIndex = lastCached;
      revStop = firstCached;
      revPrevTs = 0;
      revAcc = 0;
      drawFrame(revIndex);        // paint BEFORE revealing — never a blank canvas
      canvas.hidden = false;

      // The video is paused and fully covered by the canvas for the whole
      // reverse phase, so rewind now instead of stalling the turnaround.
      seekReady = false;
      video.addEventListener('seeked', onPreSeeked, { once: true });
      try { video.currentTime = 0; } catch (e) { seekReady = true; }

      if (!paused) rafId = requestAnimationFrame(reverseTick);
    }

    function reverseTick(ts) {
      rafId = 0;
      if (phase !== 'reverse') return;

      if (revPrevTs) revAcc += Math.min(ts - revPrevTs, 250);   // clamp long gaps
      revPrevTs = ts;

      let moved = false;
      while (revAcc >= FRAME_MS && revIndex > revStop) {
        revAcc -= FRAME_MS;
        revIndex -= 1;
        moved = true;
      }
      if (moved) drawFrame(revIndex);

      if (revIndex <= revStop) {
        restartForward();
        return;
      }
      rafId = requestAnimationFrame(reverseTick);
    }

    /* -- restart --------------------------------------------------------- */

    function restartForward() {
      if (phase === 'restarting' || phase === 'disabled') return;
      cancelRaf();
      setPhase('restarting');

      // The canvas is showing frame 0. Swap it out for the video only once
      // the video is sitting on frame 0 too — usually already true, because
      // beginReverse pre-seeked at the top of the reverse phase.
      let settled = false;
      let timer = 0;
      const resume = function () {
        if (settled) return;
        settled = true;
        seekReady = false;
        clearTimeout(timer);
        video.removeEventListener('seeked', resume);

        canvas.hidden = true;
        if (!planCapture()) {      // re-measure: the viewport may have changed
          releaseCache();
          disable();
          return;
        }
        setPhase('forward');
        if (!paused) play();       // start playback first…
        releaseCache();            // …then close the bitmaps, off the critical path
      };

      if (seekReady) {             // already rewound — hand over in this same task
        resume();
        return;
      }

      timer = setTimeout(resume, 1000);   // safety net if `seeked` never fires
      video.addEventListener('seeked', resume);

      try {
        video.currentTime = 0;
      } catch (e) {
        resume();
      }
    }

    /* -- playback -------------------------------------------------------- */

    function play() {
      const promise = video.play();
      if (promise && typeof promise.catch === 'function') {
        promise.catch(function (err) {
          // AbortError (play interrupted by pause/seek) is benign.
          if (err && err.name === 'NotAllowedError') armPlayRetry();
        });
      }
    }

    /** Autoplay was blocked — retry on the first user gesture. */
    function armPlayRetry() {
      if (retryArmed) return;
      retryArmed = true;

      const retry = function () {
        retryArmed = false;
        RETRY_EVENTS.forEach(function (type) {
          window.removeEventListener(type, retry);
        });
        if (!paused && (phase === 'forward' || phase === 'disabled')) play();
      };
      RETRY_EVENTS.forEach(function (type) {
        window.addEventListener(type, retry, { passive: true });
      });
    }

    function onPlaying() {
      if (phase === 'forward' && !rafId) rafId = requestAnimationFrame(forwardTick);
    }

    function onPause() {
      if (phase === 'forward') cancelRaf();   // nothing to sample while paused
    }

    function onEnded() {
      if (phase === 'forward') beginReverse();   // rAF was throttled; turn around now
    }

    function onVisibilityChange() {
      if (paused || phase !== 'forward') return;
      if (document.hidden) video.pause();
      else play();
    }

    /** Video failed to load: tidy up and stay out of the way. */
    function onError() {
      cancelRaf();
      releaseCache();
      seekReady = false;
      canvas.hidden = true;
      setPhase('disabled');
    }

    /** Engine can't run for this clip/device: hand looping back to the browser. */
    function disable() {
      onError();
      video.loop = true;
      if (!paused) play();
    }

    /* -- visitor control (WCAG 2.2.2) ------------------------------------ */

    function pauseLoop() {
      if (paused) return;
      paused = true;
      cancelRaf();
      video.pause();       // whichever surface is on screen stays painted
    }

    function resumeLoop() {
      if (!paused) return;
      paused = false;

      if (phase === 'reverse') {
        revPrevTs = 0;                                  // don't jump on resume
        rafId = requestAnimationFrame(reverseTick);
      } else if (phase === 'forward' || phase === 'disabled') {
        play();
      }
      // 'restarting' resumes itself: its resume() checks `paused`.
    }

    /* -- start ----------------------------------------------------------- */

    function start() {
      if (phase !== 'idle') return;
      if (!planCapture()) {
        disable();
        return;
      }

      // Autoplay may have run ahead of this deferred script; rewind so the
      // first pass caches from frame 0 (a sub-second skip during page load).
      if (video.currentTime > 2 / opts.fps) {
        try { video.currentTime = 0; } catch (e) { /* keep going from here */ }
      }

      setPhase('forward');
      if (!video.paused) onPlaying();   // already autoplaying — start sampling now
      play();
    }

    video.addEventListener('playing', onPlaying);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);
    video.addEventListener('error', onError);
    document.addEventListener('visibilitychange', onVisibilityChange);

    if (video.readyState >= 1) start();
    else video.addEventListener('loadedmetadata', start, { once: true });

    return { pause: pauseLoop, resume: resumeLoop };
  }


  /* 5. Init
     ---------------------------------------------------------------------- */

  /** Entry point — register new feature initialisers here. */
  function init() {
    initIcons();
    initYear();
    initHeroVideo();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
