/**
 * Hybrid canvas-assisted ping-pong video loop.
 *
 * Forward  : the <video> plays natively. On every animation frame the current
 *            frame is assigned to a 25 FPS slot (by frame index) and, if that
 *            slot is empty, cached as a down-scaled ImageBitmap.
 * Reverse  : `reverseLead` seconds before the end the video is paused, the
 *            <canvas> is revealed on top of it, and the cached frames are drawn
 *            backwards at 25 FPS. The video is rewound to 0 behind the canvas
 *            at the same time so the turnaround costs nothing.
 * Restart  : at frame 0 the canvas is hidden, playback resumes, and only then
 *            are the bitmaps closed (memory released) — off the critical path.
 *
 * Fallbacks: no createImageBitmap, clip too long, low-memory device, data
 *            saver, or cache over budget → the browser's native `loop`.
 */

export type Phase = 'idle' | 'forward' | 'reverse' | 'restarting' | 'disabled';

export interface PingPongOptions {
  fps: number;
  reverseLead: number;
  maxCaptureWidth: number;
  maxCacheBytes: number;
  maxFrames: number;
}

export interface PingPongHandle {
  pause(): void;
  resume(): void;
  destroy(): void;
}

interface NavigatorExtras {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
}

const MB = 1024 * 1024;

/**
 * Memory budget for the frame cache. 0 means "do not run the engine".
 * `navigator.deviceMemory` is Chromium-only and coarse; unmeasurable devices
 * are treated as the conservative 4 GB case.
 */
export function cacheBudget(): number {
  const nav = navigator as Navigator & NavigatorExtras;
  const gb = nav.deviceMemory;
  if (nav.connection?.saveData) return 0;
  if (gb !== undefined && gb < 4) return 0;
  const assumed = gb ?? 4;
  return Math.min(192 * MB, assumed * 24 * MB);
}

export const DEFAULTS: PingPongOptions = {
  fps: 25,
  reverseLead: 0.2,
  maxCaptureWidth: 1280,
  maxCacheBytes: cacheBudget(),
  maxFrames: 25 * 20,
};

/** Reduced motion: present the first frame as a still instead of motion. */
export function holdStill(video: HTMLVideoElement): void {
  const freeze = () => {
    video.pause();
    video.loop = false;
    try { video.currentTime = 0; } catch { /* not seekable yet */ }
  };
  video.autoplay = false;
  if (video.readyState >= 1) freeze();
  else video.addEventListener('loadedmetadata', freeze, { once: true });
}

export function createPingPongLoop(
  stage: HTMLElement,
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  opts: PingPongOptions = DEFAULTS,
): PingPongHandle | null {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return null;

  const FRAME_MS = 1000 / opts.fps;
  const RETRY_EVENTS = ['pointerdown', 'keydown', 'touchstart'] as const;

  let phase: Phase = 'idle';
  let frames: Array<ImageBitmap | null | undefined> = [];
  let frameCount = 0;
  let cachedCount = 0;
  let firstCached = Infinity;
  let lastCached = -1;
  let generation = 0;
  let captureW = 0;
  let captureH = 0;
  let rafId = 0;
  let budgetChecked = false;
  let retryArmed = false;
  let paused = false;
  let seekReady = false;

  let revIndex = 0;
  let revStop = 0;
  let revPrevTs = 0;
  let revAcc = 0;

  video.loop = false;
  video.muted = true;

  /* -- state --------------------------------------------------------------- */

  function setPhase(next: Phase): void {
    phase = next;
    stage.dataset.phase = next;
    stage.dispatchEvent(new CustomEvent('pingpong:phase', {
      bubbles: true,
      detail: { phase: next, cached: cachedCount, width: captureW, height: captureH },
    }));
  }

  function cancelRaf(): void {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  /* -- cache --------------------------------------------------------------- */

  function planCapture(): boolean {
    if (!opts.maxCacheBytes) return false;

    const duration = video.duration;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!Number.isFinite(duration) || duration <= 0 || !vw || !vh) return false;

    frameCount = Math.ceil(duration * opts.fps) + 1;
    if (frameCount > opts.maxFrames) return false;

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

  function captureFrame(time: number): void {
    const index = Math.round(time * opts.fps);
    if (index < 0 || index >= frameCount || frames[index] !== undefined) return;

    frames[index] = null;
    const gen = generation;

    createImageBitmap(video, {
      resizeWidth: captureW,
      resizeHeight: captureH,
      resizeQuality: 'medium',
    }).then((bitmap) => {
      if (gen !== generation) {
        bitmap.close();
        return;
      }
      if (!budgetChecked) {
        budgetChecked = true;
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
    }).catch(() => {
      if (gen === generation) frames[index] = undefined;
    });
  }

  function drawFrame(index: number): void {
    let i = Math.min(index, frames.length - 1);
    while (i >= 0 && !frames[i]) i -= 1;
    const bmp = i >= 0 ? frames[i] : null;
    if (bmp) ctx!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  }

  function releaseCache(): void {
    generation += 1;
    for (const f of frames) f?.close();
    frames = [];
    cachedCount = 0;
    firstCached = Infinity;
    lastCached = -1;
  }

  /* -- forward ------------------------------------------------------------- */

  function forwardTick(): void {
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

  /* -- reverse ------------------------------------------------------------- */

  const onPreSeeked = (): void => { seekReady = true; };

  function beginReverse(): void {
    if (phase !== 'forward') return;
    cancelRaf();
    video.pause();

    // Only reverse when the cache actually reaches the start of the clip.
    if (lastCached < 0 || firstCached > 2) {
      restartForward();
      return;
    }

    setPhase('reverse');
    revIndex = lastCached;
    revStop = firstCached;
    revPrevTs = 0;
    revAcc = 0;
    drawFrame(revIndex);
    canvas.hidden = false;

    seekReady = false;
    video.addEventListener('seeked', onPreSeeked, { once: true });
    try { video.currentTime = 0; } catch { seekReady = true; }

    if (!paused) rafId = requestAnimationFrame(reverseTick);
  }

  function reverseTick(ts: number): void {
    rafId = 0;
    if (phase !== 'reverse') return;

    if (revPrevTs) revAcc += Math.min(ts - revPrevTs, 250);
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

  /* -- restart ------------------------------------------------------------- */

  function restartForward(): void {
    if (phase === 'restarting' || phase === 'disabled') return;
    cancelRaf();
    setPhase('restarting');

    let settled = false;
    let timer = 0;
    const resume = (): void => {
      if (settled) return;
      settled = true;
      seekReady = false;
      window.clearTimeout(timer);
      video.removeEventListener('seeked', resume);

      canvas.hidden = true;
      if (!planCapture()) {
        releaseCache();
        disable();
        return;
      }
      setPhase('forward');
      if (!paused) play();
      releaseCache();
    };

    if (seekReady) {
      resume();
      return;
    }

    timer = window.setTimeout(resume, 1000);
    video.addEventListener('seeked', resume);
    try { video.currentTime = 0; } catch { resume(); }
  }

  /* -- playback ------------------------------------------------------------ */

  function play(): void {
    const promise = video.play();
    if (promise && typeof promise.catch === 'function') {
      promise.catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'NotAllowedError') armPlayRetry();
      });
    }
  }

  function armPlayRetry(): void {
    if (retryArmed) return;
    retryArmed = true;
    const retry = (): void => {
      retryArmed = false;
      RETRY_EVENTS.forEach((type) => window.removeEventListener(type, retry));
      if (!paused && (phase === 'forward' || phase === 'disabled')) play();
    };
    RETRY_EVENTS.forEach((type) => window.addEventListener(type, retry, { passive: true }));
  }

  const onPlaying = (): void => {
    if (phase === 'forward' && !rafId) rafId = requestAnimationFrame(forwardTick);
  };
  const onPause = (): void => {
    if (phase === 'forward') cancelRaf();
  };
  const onEnded = (): void => {
    if (phase === 'forward') beginReverse();
  };
  const onVisibilityChange = (): void => {
    if (paused || phase !== 'forward') return;
    if (document.hidden) video.pause();
    else play();
  };
  const onError = (): void => {
    cancelRaf();
    releaseCache();
    seekReady = false;
    canvas.hidden = true;
    setPhase('disabled');
  };

  function disable(): void {
    onError();
    video.loop = true;
    if (!paused) play();
  }

  /* -- visitor control ----------------------------------------------------- */

  function pauseLoop(): void {
    if (paused) return;
    paused = true;
    cancelRaf();
    video.pause();
  }

  function resumeLoop(): void {
    if (!paused) return;
    paused = false;
    if (phase === 'reverse') {
      revPrevTs = 0;
      rafId = requestAnimationFrame(reverseTick);
    } else if (phase === 'forward' || phase === 'disabled') {
      play();
    }
  }

  /* -- start --------------------------------------------------------------- */

  function start(): void {
    if (phase !== 'idle') return;
    if (!planCapture()) {
      disable();
      return;
    }
    if (video.currentTime > 2 / opts.fps) {
      try { video.currentTime = 0; } catch { /* keep going */ }
    }
    setPhase('forward');
    if (!video.paused) onPlaying();
    play();
  }

  video.addEventListener('playing', onPlaying);
  video.addEventListener('pause', onPause);
  video.addEventListener('ended', onEnded);
  video.addEventListener('error', onError);
  document.addEventListener('visibilitychange', onVisibilityChange);

  if (video.readyState >= 1) start();
  else video.addEventListener('loadedmetadata', start, { once: true });

  return {
    pause: pauseLoop,
    resume: resumeLoop,
    destroy(): void {
      cancelRaf();
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('error', onError);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      releaseCache();
      canvas.hidden = true;
      video.loop = true;
      setPhase('disabled');
    },
  };
}
