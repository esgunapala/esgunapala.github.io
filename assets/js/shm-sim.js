// Simple harmonic motion visualizer: a mass on a horizontal spring, with
// adjustable amplitude, spring constant, and mass, plus position/velocity/
// acceleration vs. time graphs synced to a scrubbable time slider.
(function () {
  var PERIODS_SHOWN = 2; // show two full oscillations in the graphs
  var SAMPLES = 220;

  function omegaOf(k, m) { return Math.sqrt(k / m); }
  function periodOf(k, m) { return (2 * Math.PI) / omegaOf(k, m); }

  function stateAt(t, X, k, m) {
    var w = omegaOf(k, m);
    return {
      x: X * Math.cos(w * t),
      v: -X * w * Math.sin(w * t),
      a: -X * w * w * Math.cos(w * t),
    };
  }

  function initSim(root) {
    var trackCanvas = root.querySelector("[data-shm-track]");
    var graphCanvases = {
      position: root.querySelector('[data-shm-graph="position"]'),
      velocity: root.querySelector('[data-shm-graph="velocity"]'),
      acceleration: root.querySelector('[data-shm-graph="acceleration"]'),
    };
    var ampInput = root.querySelector("[data-shm-amplitude]");
    var ampOut = root.querySelector("[data-shm-amplitude-out]");
    var kInput = root.querySelector("[data-shm-k]");
    var kOut = root.querySelector("[data-shm-k-out]");
    var mInput = root.querySelector("[data-shm-mass]");
    var mOut = root.querySelector("[data-shm-mass-out]");
    var timeInput = root.querySelector("[data-shm-time]");
    var timeOut = root.querySelector("[data-shm-time-out]");
    var playBtn = root.querySelector("[data-shm-play]");
    var resetBtn = root.querySelector("[data-shm-reset]");
    var xOut = root.querySelector("[data-shm-x]");
    var vOut = root.querySelector("[data-shm-v]");
    var aOut = root.querySelector("[data-shm-a]");
    var periodOut = root.querySelector("[data-shm-period]");
    var freqOut = root.querySelector("[data-shm-freq]");

    var duration = 4;
    var curve = [];
    var xRange, vRange, aRange;
    var animId = null;
    var playing = false;

    function params() {
      return { X: parseFloat(ampInput.value), k: parseFloat(kInput.value), m: parseFloat(mInput.value) };
    }

    function rangeWithZero(values) {
      var min = Math.min.apply(null, values.concat([0]));
      var max = Math.max.apply(null, values.concat([0]));
      var pad = (max - min) * 0.15 || 1;
      return { min: min - pad, max: max + pad };
    }

    function recompute() {
      var p = params();
      var T = periodOf(p.k, p.m);
      duration = Math.round(T * PERIODS_SHOWN * 100) / 100;
      timeInput.min = 0;
      timeInput.max = duration;
      timeInput.step = Math.max(Math.round((duration / 300) * 1000) / 1000, 0.01);

      curve = [];
      var xs = [], vs = [], as = [];
      for (var i = 0; i <= SAMPLES; i++) {
        var t = (duration * i) / SAMPLES;
        var s = stateAt(t, p.X, p.k, p.m);
        curve.push({ t: t, x: s.x, v: s.v, a: s.a });
        xs.push(s.x); vs.push(s.v); as.push(s.a);
      }
      xRange = rangeWithZero(xs);
      vRange = rangeWithZero(vs);
      aRange = rangeWithZero(as);

      periodOut.textContent = T.toFixed(2) + " s";
      freqOut.textContent = (1 / T).toFixed(2) + " Hz";
    }

    function resizeCanvas(canvas, aspect) {
      var rect = canvas.getBoundingClientRect();
      var ratio = window.devicePixelRatio || 1;
      var w = rect.width;
      var h = rect.width * aspect;
      canvas.width = w * ratio;
      canvas.height = h * ratio;
      canvas.style.height = h + "px";
      var ctx = canvas.getContext("2d");
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      return { ctx: ctx, w: w, h: h };
    }

    function drawSpring(ctx, x0, y, x1, coils) {
      var len = x1 - x0;
      var segs = coils * 2;
      var segLen = len / segs;
      var amp = 9;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      for (var i = 1; i < segs; i++) {
        var sx = x0 + i * segLen;
        var sy = y + (i % 2 === 0 ? 0 : (i % 4 === 1 ? -amp : amp));
        ctx.lineTo(sx, sy);
      }
      ctx.lineTo(x1, y);
      ctx.stroke();
    }

    function drawTrack(t) {
      var dims = resizeCanvas(trackCanvas, 0.24);
      var ctx = dims.ctx, W = dims.w, H = dims.h;
      ctx.clearRect(0, 0, W, H);
      var margin = 30;
      var p = params();
      var s = stateAt(t, p.X, p.k, p.m);

      var y = H / 2;
      var wallX = margin;
      var equilibriumX = W * 0.55;
      var maxAmpPx = W * 0.30;
      var pxPerMeter = maxAmpPx / Math.max(p.X, 0.001);

      // wall
      ctx.fillStyle = "#8a93a8";
      ctx.fillRect(wallX - 6, y - 40, 6, 80);

      // equilibrium marker
      ctx.strokeStyle = "#c7cede";
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(equilibriumX, y - 45);
      ctx.lineTo(equilibriumX, y + 45);
      ctx.stroke();
      ctx.setLineDash([]);

      var massPx = W * 0.055;
      var blockX = equilibriumX + s.x * pxPerMeter;

      // spring
      ctx.strokeStyle = "#8a93a8";
      ctx.lineWidth = 2;
      drawSpring(ctx, wallX, y, blockX - massPx, 8);

      // mass block
      ctx.fillStyle = "#eef3fc";
      ctx.strokeStyle = "#2f5d9f";
      ctx.lineWidth = 1.5;
      ctx.fillRect(blockX - massPx, y - massPx, massPx * 2, massPx * 2);
      ctx.strokeRect(blockX - massPx, y - massPx, massPx * 2, massPx * 2);

      // ground
      ctx.strokeStyle = "#dfe3ec";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(margin, y + massPx + 14);
      ctx.lineTo(W - margin, y + massPx + 14);
      ctx.stroke();

      ctx.fillStyle = "#8a93a8";
      ctx.font = "600 11px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("Dashed line = equilibrium position", margin, 4);
    }

    function drawGraph(key, title, unit, range) {
      var canvas = graphCanvases[key];
      var dims = resizeCanvas(canvas, 0.3);
      var ctx = dims.ctx, W = dims.w, H = dims.h;
      ctx.clearRect(0, 0, W, H);

      var marginL = 34, marginR = 10, marginT = 20, marginB = 18;
      var plotW = W - marginL - marginR;
      var plotH = H - marginT - marginB;

      function xPix(t) { return marginL + (t / duration) * plotW; }
      function yPix(v) { return marginT + (1 - (v - range.min) / (range.max - range.min)) * plotH; }

      ctx.strokeStyle = "#eceff5";
      ctx.fillStyle = "#8a93a8";
      ctx.font = "10px system-ui, sans-serif";
      ctx.lineWidth = 1;
      var hLines = [range.min, (range.min + range.max) / 2, range.max];
      hLines.forEach(function (v) {
        var y = yPix(v);
        ctx.beginPath();
        ctx.moveTo(marginL, y);
        ctx.lineTo(W - marginR, y);
        ctx.stroke();
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(v.toFixed(2), marginL - 5, y);
      });
      var tTicks = 4;
      for (var i = 0; i <= tTicks; i++) {
        var t = (duration * i) / tTicks;
        var x = xPix(t);
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(t.toFixed(1) + "s", x, H - marginB + 3);
      }

      if (range.min < 0 && range.max > 0) {
        ctx.strokeStyle = "#c7cede";
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(marginL, yPix(0));
        ctx.lineTo(W - marginR, yPix(0));
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.strokeStyle = "#2f5d9f";
      ctx.lineWidth = 2;
      ctx.beginPath();
      curve.forEach(function (pt, i) {
        var x = xPix(pt.t), y = yPix(pt[key === "acceleration" ? "a" : key === "velocity" ? "v" : "x"]);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();

      var curT = parseFloat(timeInput.value);
      var p = params();
      var s = stateAt(curT, p.X, p.k, p.m);
      var curVal = key === "acceleration" ? s.a : key === "velocity" ? s.v : s.x;
      var mx = xPix(curT);
      ctx.strokeStyle = "#b3261e";
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(mx, marginT);
      ctx.lineTo(mx, H - marginB);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#b3261e";
      ctx.beginPath();
      ctx.arc(mx, yPix(curVal), 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#1f2430";
      ctx.font = "600 11px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(title + " (" + unit + ")", marginL, 2);
    }

    function redraw() {
      var t = parseFloat(timeInput.value);
      drawTrack(t);
      drawGraph("position", "Position", "m", xRange);
      drawGraph("velocity", "Velocity", "m/s", vRange);
      drawGraph("acceleration", "Acceleration", "m/s²", aRange);

      var p = params();
      var s = stateAt(t, p.X, p.k, p.m);
      xOut.textContent = s.x.toFixed(2) + " m";
      vOut.textContent = s.v.toFixed(2) + " m/s";
      aOut.textContent = s.a.toFixed(2) + " m/s²";
      timeOut.textContent = t.toFixed(2) + " s";
    }

    function onParamsChanged() {
      recompute();
      redraw();
    }

    function stopPlaying() {
      playing = false;
      if (animId) cancelAnimationFrame(animId);
      animId = null;
      playBtn.textContent = "Play";
    }

    function play() {
      if (playing) { stopPlaying(); return; }
      playing = true;
      playBtn.textContent = "Pause";
      var startTime = null;
      var startAt = parseFloat(timeInput.value);
      if (startAt >= duration - 0.001) startAt = 0;

      function frame(ts) {
        if (!playing) return;
        if (!startTime) startTime = ts;
        var elapsed = (ts - startTime) / 1000 + startAt;
        if (elapsed >= duration) {
          timeInput.value = duration;
          redraw();
          stopPlaying();
          return;
        }
        timeInput.value = elapsed;
        redraw();
        animId = requestAnimationFrame(frame);
      }
      animId = requestAnimationFrame(frame);
    }

    [ampInput, kInput, mInput].forEach(function (input) {
      input.addEventListener("input", function () {
        ampOut.textContent = parseFloat(ampInput.value).toFixed(2) + " m";
        kOut.textContent = parseFloat(kInput.value).toFixed(0) + " N/m";
        mOut.textContent = parseFloat(mInput.value).toFixed(1) + " kg";
        stopPlaying();
        timeInput.value = 0;
        onParamsChanged();
      });
    });
    timeInput.addEventListener("input", function () {
      if (!playing) redraw();
    });
    playBtn.addEventListener("click", play);
    resetBtn.addEventListener("click", function () {
      stopPlaying();
      ampInput.value = 0.3;
      kInput.value = 20;
      mInput.value = 1;
      ampOut.textContent = "0.30 m";
      kOut.textContent = "20 N/m";
      mOut.textContent = "1.0 kg";
      timeInput.value = 0;
      onParamsChanged();
    });
    window.addEventListener("resize", redraw);

    ampOut.textContent = parseFloat(ampInput.value).toFixed(2) + " m";
    kOut.textContent = parseFloat(kInput.value).toFixed(0) + " N/m";
    mOut.textContent = parseFloat(mInput.value).toFixed(1) + " kg";
    onParamsChanged();
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-shm-sim]").forEach(initSim);
  });
})();
