// Two-cart 1D collision visualizer: adjustable mass and initial velocity for
// each cart, elastic or perfectly-inelastic collision, live momentum and
// kinetic-energy readouts with a conservation check.
(function () {
  var DURATION = 6; // seconds — fixed animation window
  var SEPARATION = 3; // meters between cart centers at t = 0

  function boxHalfWidth(mass) {
    // visual size scales gently with mass so a heavier cart looks heavier
    return 0.18 + 0.10 * Math.sqrt(mass);
  }

  function computeCollision(m1, v1i, m2, v2i, mode) {
    var h1 = boxHalfWidth(m1), h2 = boxHalfWidth(m2);
    var x1_0 = -SEPARATION / 2, x2_0 = SEPARATION / 2;
    var gap = (x2_0 - h2) - (x1_0 + h1); // distance between facing surfaces
    var closingSpeed = v1i - v2i;
    var willCollide = closingSpeed > 1e-9 && gap / closingSpeed < DURATION;
    var tc = willCollide ? gap / closingSpeed : null;

    var v1f = v1i, v2f = v2i;
    if (willCollide) {
      if (mode === "inelastic") {
        var vf = (m1 * v1i + m2 * v2i) / (m1 + m2);
        v1f = vf;
        v2f = vf;
      } else {
        v1f = ((m1 - m2) / (m1 + m2)) * v1i + ((2 * m2) / (m1 + m2)) * v2i;
        v2f = ((2 * m1) / (m1 + m2)) * v1i + ((m2 - m1) / (m1 + m2)) * v2i;
      }
    }

    return { h1: h1, h2: h2, x1_0: x1_0, x2_0: x2_0, willCollide: willCollide, tc: tc, v1f: v1f, v2f: v2f };
  }

  function positionsAt(t, m1, v1i, m2, v2i, mode, geo) {
    var x1, x2;
    if (!geo.willCollide || t < geo.tc) {
      x1 = geo.x1_0 + v1i * t;
      x2 = geo.x2_0 + v2i * t;
    } else {
      var x1c = geo.x1_0 + v1i * geo.tc;
      var x2c = geo.x2_0 + v2i * geo.tc;
      var dt = t - geo.tc;
      x1 = x1c + geo.v1f * dt;
      x2 = x2c + geo.v2f * dt;
    }
    return { x1: x1, x2: x2 };
  }

  function initSim(root) {
    var sceneCanvas = root.querySelector("[data-collision-scene]");
    var m1Input = root.querySelector("[data-collision-m1]");
    var m1Out = root.querySelector("[data-collision-m1-out]");
    var v1Input = root.querySelector("[data-collision-v1]");
    var v1Out = root.querySelector("[data-collision-v1-out]");
    var m2Input = root.querySelector("[data-collision-m2]");
    var m2Out = root.querySelector("[data-collision-m2-out]");
    var v2Input = root.querySelector("[data-collision-v2]");
    var v2Out = root.querySelector("[data-collision-v2-out]");
    var modeInput = root.querySelector("[data-collision-mode]");
    var timeInput = root.querySelector("[data-collision-time]");
    var timeOut = root.querySelector("[data-collision-time-out]");
    var playBtn = root.querySelector("[data-collision-play]");
    var resetBtn = root.querySelector("[data-collision-reset]");
    var statusOut = root.querySelector("[data-collision-status]");
    var pBeforeOut = root.querySelector("[data-collision-p-before]");
    var pAfterOut = root.querySelector("[data-collision-p-after]");
    var keBeforeOut = root.querySelector("[data-collision-ke-before]");
    var keAfterOut = root.querySelector("[data-collision-ke-after]");
    var v1fOut = root.querySelector("[data-collision-v1f]");
    var v2fOut = root.querySelector("[data-collision-v2f]");

    var animId = null;
    var playing = false;
    var worldHalfWidth = 3;

    function params() {
      return {
        m1: parseFloat(m1Input.value),
        v1i: parseFloat(v1Input.value),
        m2: parseFloat(m2Input.value),
        v2i: parseFloat(v2Input.value),
        mode: modeInput.value,
      };
    }

    function recomputeScale(p, geo) {
      var extremes = [geo.x1_0, geo.x2_0];
      [0, DURATION].concat(geo.willCollide ? [geo.tc] : []).forEach(function (t) {
        var pos = positionsAt(t, p.m1, p.v1i, p.m2, p.v2i, p.mode, geo);
        extremes.push(pos.x1, pos.x2);
      });
      var maxAbs = Math.max.apply(null, extremes.map(Math.abs));
      worldHalfWidth = Math.max(maxAbs * 1.2, 2);
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

    function drawArrow(ctx, x0, y0, dx, color, label) {
      if (Math.abs(dx) < 1) return;
      var x1 = x0 + dx;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y0);
      ctx.stroke();
      var dir = dx >= 0 ? 1 : -1;
      var head = 7;
      ctx.beginPath();
      ctx.moveTo(x1, y0);
      ctx.lineTo(x1 - dir * head, y0 - head / 2);
      ctx.lineTo(x1 - dir * head, y0 + head / 2);
      ctx.closePath();
      ctx.fill();
      if (label) {
        ctx.font = "600 11px system-ui, sans-serif";
        ctx.fillText(label, x1 + (dir >= 0 ? 4 : -4 - ctx.measureText(label).width), y0 - 8);
      }
    }

    function drawScene(t) {
      var dims = resizeCanvas(sceneCanvas, 0.42);
      var ctx = dims.ctx, W = dims.w, H = dims.h;
      ctx.clearRect(0, 0, W, H);

      var p = params();
      var geo = computeCollision(p.m1, p.v1i, p.m2, p.v2i, p.mode);
      var pos = positionsAt(t, p.m1, p.v1i, p.m2, p.v2i, p.mode, geo);
      var groundY = H * 0.62;
      var margin = 28;
      var pxPerMeter = (W - 2 * margin) / (2 * worldHalfWidth);

      // Track
      ctx.strokeStyle = "#c7cede";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(margin, groundY);
      ctx.lineTo(W - margin, groundY);
      ctx.stroke();
      ctx.strokeStyle = "#dfe3ec";
      ctx.lineWidth = 1;
      for (var hx = margin; hx < W - margin; hx += 10) {
        ctx.beginPath();
        ctx.moveTo(hx, groundY);
        ctx.lineTo(hx - 6, groundY + 8);
        ctx.stroke();
      }

      function cartBoxSize(mass) {
        return Math.min(56, Math.max(22, boxHalfWidth(mass) * 2 * pxPerMeter));
      }

      var b1 = cartBoxSize(p.m1), b2 = cartBoxSize(p.m2);
      var cx1 = W / 2 + pos.x1 * pxPerMeter;
      var cx2 = W / 2 + pos.x2 * pxPerMeter;
      var cy1 = groundY - b1 / 2;
      var cy2 = groundY - b2 / 2;

      var collided = geo.willCollide && t >= geo.tc;
      var v1now = collided ? geo.v1f : p.v1i;
      var v2now = collided ? geo.v2f : p.v2i;

      // Cart 1
      ctx.fillStyle = "#eef3fc";
      ctx.strokeStyle = "#3a63c8";
      ctx.lineWidth = 1.5;
      ctx.fillRect(cx1 - b1 / 2, cy1 - b1 / 2, b1, b1);
      ctx.strokeRect(cx1 - b1 / 2, cy1 - b1 / 2, b1, b1);
      ctx.font = "600 11px system-ui, sans-serif";
      ctx.fillStyle = "#3a63c8";
      ctx.fillText("1", cx1 - 3, cy1 + 4);

      // Cart 2
      ctx.fillStyle = "#fdf3e3";
      ctx.strokeStyle = "#c9722c";
      ctx.fillRect(cx2 - b2 / 2, cy2 - b2 / 2, b2, b2);
      ctx.strokeRect(cx2 - b2 / 2, cy2 - b2 / 2, b2, b2);
      ctx.fillStyle = "#c9722c";
      ctx.fillText("2", cx2 - 3, cy2 + 4);

      // Velocity arrows
      var maxV = Math.max(Math.abs(p.v1i), Math.abs(p.v2i), 1);
      var pxPerMS = 40 / maxV;
      drawArrow(ctx, cx1, cy1 - b1 / 2 - 10, v1now * pxPerMS, "#3a63c8", v1now.toFixed(1) + " m/s");
      drawArrow(ctx, cx2, cy2 - b2 / 2 - 10, v2now * pxPerMS, "#c9722c", v2now.toFixed(1) + " m/s");

      if (collided) {
        ctx.font = "600 11px system-ui, sans-serif";
        ctx.fillStyle = "#8a93a8";
        ctx.fillText("collided at t = " + geo.tc.toFixed(2) + " s", margin, groundY + 24);
      }
    }

    function updateReadouts(t) {
      var p = params();
      var geo = computeCollision(p.m1, p.v1i, p.m2, p.v2i, p.mode);
      var collided = geo.willCollide && t >= geo.tc;

      var pBefore = p.m1 * p.v1i + p.m2 * p.v2i;
      var keBefore = 0.5 * p.m1 * p.v1i * p.v1i + 0.5 * p.m2 * p.v2i * p.v2i;
      var v1f = collided ? geo.v1f : p.v1i;
      var v2f = collided ? geo.v2f : p.v2i;
      var pAfter = p.m1 * v1f + p.m2 * v2f;
      var keAfter = 0.5 * p.m1 * v1f * v1f + 0.5 * p.m2 * v2f * v2f;

      if (!geo.willCollide) {
        statusOut.textContent = "No collision — cart 1 never catches up to cart 2";
        statusOut.style.color = "var(--color-muted, #8a93a8)";
      } else if (!collided) {
        statusOut.textContent = "Approaching — collision at t = " + geo.tc.toFixed(2) + " s";
        statusOut.style.color = "var(--color-primary)";
      } else {
        statusOut.textContent = (p.mode === "inelastic" ? "Collided (perfectly inelastic — stuck together)" : "Collided (elastic)");
        statusOut.style.color = "var(--color-success)";
      }

      pBeforeOut.textContent = pBefore.toFixed(2) + " kg·m/s";
      pAfterOut.textContent = pAfter.toFixed(2) + " kg·m/s";
      keBeforeOut.textContent = keBefore.toFixed(2) + " J";
      keAfterOut.textContent = keAfter.toFixed(2) + " J" + (p.mode === "inelastic" && geo.willCollide ? "  (" + (100 * (1 - keAfter / Math.max(keBefore, 1e-9))).toFixed(0) + "% lost to heat/deformation)" : "");
      v1fOut.textContent = v1f.toFixed(2) + " m/s";
      v2fOut.textContent = v2f.toFixed(2) + " m/s";
    }

    function redraw() {
      var t = parseFloat(timeInput.value);
      timeOut.textContent = t.toFixed(2) + " s";
      drawScene(t);
      updateReadouts(t);
    }

    function onParamsChanged() {
      var p = params();
      var geo = computeCollision(p.m1, p.v1i, p.m2, p.v2i, p.mode);
      recomputeScale(p, geo);
      m1Out.textContent = p.m1.toFixed(0) + " kg";
      v1Out.textContent = p.v1i.toFixed(1) + " m/s";
      m2Out.textContent = p.m2.toFixed(0) + " kg";
      v2Out.textContent = p.v2i.toFixed(1) + " m/s";
      redraw();
    }

    function play() {
      if (playing) { stopPlaying(); return; }
      playing = true;
      playBtn.textContent = "Pause";
      var start = performance.now() - parseFloat(timeInput.value) * 1000;
      function frame(now) {
        var t = (now - start) / 1000;
        if (t >= DURATION) {
          t = DURATION;
          timeInput.value = t;
          redraw();
          stopPlaying();
          return;
        }
        timeInput.value = t;
        redraw();
        animId = requestAnimationFrame(frame);
      }
      animId = requestAnimationFrame(frame);
    }
    function stopPlaying() {
      playing = false;
      playBtn.textContent = "Play";
      if (animId) cancelAnimationFrame(animId);
      animId = null;
    }

    [m1Input, v1Input, m2Input, v2Input, modeInput].forEach(function (input) {
      input.addEventListener("input", function () {
        stopPlaying();
        onParamsChanged();
      });
    });
    timeInput.addEventListener("input", function () {
      if (!playing) redraw();
    });
    playBtn.addEventListener("click", play);
    resetBtn.addEventListener("click", function () {
      stopPlaying();
      m1Input.value = 2;
      v1Input.value = 2;
      m2Input.value = 1;
      v2Input.value = -1;
      modeInput.value = "elastic";
      timeInput.value = 0;
      onParamsChanged();
    });
    window.addEventListener("resize", redraw);

    timeInput.min = 0;
    timeInput.max = DURATION;
    timeInput.step = 0.02;
    onParamsChanged();
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-collision-sim]").forEach(initSim);
  });
})();
