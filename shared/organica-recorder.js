/* ─────────────────────────────────────────────────────────────────────────────
 * organica-recorder.js — the Organica canvas video recorder.
 *
 * Consolidates the canvas.captureStream() + MediaRecorder + MIME-fallback dance
 * that Pulsar, Camo Turing, Vortex and Membrane each hand-rolled (Vortex's and
 * Membrane's copies were already byte-identical; Camo Turing's was the original).
 * Soul is deliberately NOT a consumer — it animates SVG DOM with GSAP, has no
 * live canvas, and rasterises each frame onto a throwaway canvas with its own
 * requestAnimationFrame pump; its recorder stays local.
 *
 * LOAD ORDER: organica-core.js → organica-recorder.js → tool script.
 * Needs Organica.download / Organica.stamp from core. Ships no UI and no paired
 * CSS — each tool keeps its own floatbar button and wires the toggle to it.
 *
 * ── Organica.recorder(config) → { toggle, start, stop, isRecording } ─────────
 *   canvas         required — the live <canvas> to capture, OR a function that
 *                  returns it (p5 tools whose canvas isn't up at construct time)
 *   tool           required — Organica.stamp() filename prefix
 *   fps            default 30 — canvas.captureStream(fps)
 *   duration       omit ⇒ manual-only (stop() is the only end).
 *                  number | () => number ⇒ auto-stop after that many seconds.
 *                  A function is resolved at start() — Pulsar reads loopSec then.
 *   durationPadMs  default 0 — extra ms on the auto-stop timer so the final loop
 *                  frame lands in the file (Pulsar uses 90).
 *   onStart()      "force it running" hook — called just before recorder.start()
 *                  so a paused / frozen / resting tool starts playing first.
 *   onStatus(phase, msg)   phase ∈ 'recording' | 'saved' | 'error'. Optional —
 *                  the tool routes it to its status pill or a hint <p>.
 *   onStateChange(isRecording)   for the tool to relabel its button. Optional.
 *
 * The merged best version of the four copies:
 *   - MIME list is the superset 5-entry order (Camo Turing / Vortex / Membrane):
 *     mp4;avc1 → mp4 → webm;vp9 → webm;vp8 → webm. MP4/H.264 first because it
 *     opens everywhere without friction (QuickTime, Windows, iOS Photos,
 *     Keynote, every editor and social upload); webm is the fallback. Each
 *     isTypeSupported() call is wrapped — it can throw (Pulsar's guard).
 *   - The extension is sniffed from the NEGOTIATED mediaRecorder.mimeType after
 *     construction, not from the candidate pair — the browser may settle on a
 *     codec that isn't first in the list (Soul/Pulsar already did this; it is
 *     the more correct of the two prior approaches).
 * ───────────────────────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';
  const Organica = global.Organica || (global.Organica = {});

  const MIME_CANDIDATES = [
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];

  function supported(mime) {
    try {
      return typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime);
    } catch (e) {
      return false;
    }
  }

  Organica.recorder = function (config) {
    const canvasOf = () => (typeof config.canvas === 'function' ? config.canvas() : config.canvas);
    const tool = config.tool || 'organica';
    const fps = config.fps || 30;
    const padMs = config.durationPadMs || 0;
    const onStart = config.onStart || function () {};
    const onStatus = config.onStatus || function () {};
    const onStateChange = config.onStateChange || function () {};

    let mediaRecorder = null;
    let chunks = [];
    let timer = 0;

    function isRecording() {
      return !!mediaRecorder && mediaRecorder.state === 'recording';
    }

    function start() {
      if (isRecording()) return;
      const canvas = canvasOf();
      if (!canvas || typeof canvas.captureStream !== 'function' ||
          typeof global.MediaRecorder === 'undefined') {
        onStatus('error', "Video recording isn't supported in this browser");
        return;
      }
      const mime = MIME_CANDIDATES.find(supported);
      if (!mime) {
        onStatus('error', 'No supported video format found in this browser');
        return;
      }
      try {
        const stream = canvas.captureStream(fps);
        mediaRecorder = new MediaRecorder(stream, { mimeType: mime });
      } catch (err) {
        mediaRecorder = null;
        onStatus('error', 'Could not start recording: ' + err.message);
        return;
      }
      chunks = [];
      mediaRecorder.ondataavailable = function (e) {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      mediaRecorder.onstop = function () {
        const type = (mediaRecorder && mediaRecorder.mimeType) || mime || 'video/webm';
        const ext = type.indexOf('mp4') >= 0 ? 'mp4' : 'webm';
        Organica.download(new Blob(chunks, { type: type }), Organica.stamp(tool, ext));
        mediaRecorder = null;
        clearTimeout(timer);
        onStateChange(false);
        onStatus('saved', 'Recording saved');
      };

      onStart();
      mediaRecorder.start();
      onStateChange(true);
      onStatus('recording', 'Recording…');

      let secs = config.duration;
      if (typeof secs === 'function') secs = secs();
      if (typeof secs === 'number' && secs > 0) {
        timer = setTimeout(stop, secs * 1000 + padMs);
      }
    }

    function stop() {
      clearTimeout(timer);
      if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    }

    function toggle() {
      if (isRecording()) stop(); else start();
    }

    return { toggle: toggle, start: start, stop: stop, isRecording: isRecording };
  };
})(typeof window !== 'undefined' ? window : this);
