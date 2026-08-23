// Force & friction visualizer: a box on a horizontal surface, pushed or
// pulled by an applied force, with static and kinetic friction resisting
// it. Shows the free-body diagram and whether the box stays put (static
// friction holds it) or slides (kinetic friction takes over).
(function () {
  var G = 9.81;
  var DURATION = 5; // seconds — fixed animation window
  var SAMPLES = 200;

  function computeState(mass, applied, muS, muK) {
    var weight = mass * G;
    var normal = weight; // horizontal surface, no vertical component to applied force
    var maxStatic = muS * normal;
    var moving = Math.abs(applied) > maxStatic;
    var friction, netForce, accel;
    if (!moving) {
      friction = -applied; // static friction exactly balances the applied force
      netForce = 0;
      accel = 0;
    } else {
      var dir = applied >= 0 ? 1 : -1;
      friction = -dir * muK * normal;
      netForce = applied + friction;
      accel = netForce / mass;
    }
    return { weight: weight, normal: normal, maxStatic: maxStatic, moving: moving, friction: friction, netForce: netForce, accel: accel };
  }

  function positionAt(t, state) {
    if (!state.moving) return { x: 0, v: 0 };
    return { x: 0.5 * state.accel * t * t, v: state.accel * t };
  }

  function initSim(root) {
    var sceneCanvas = root.querySelector("[data-force-scene]");
    var massInput = root.querySelector("[data-force-mass]");
    var massOut = root.querySelector("[data-force-mass-out]");
    var appliedInput = root.querySelector("[data-force-applied]");
    var appliedOut = root.querySelector("[data-force-applied-out]");
    var muSInput = root.querySelector("[data-force-mus]");
    var muSOut = root.querySelector("[data-force-mus-out]");
    var muKInput = root.querySelector("[data-force-muk]");
    var muKOut = root.querySelector("[data-force-muk-out]");
    var timeInput = root.querySelector("[data-force-time]");
    var timeOut = root.querySelector("[data-force-time-out]");
    var playBtn = root.querySelector("[data-force-play]");
    var resetBtn = root.querySelector("[data-force-reset]");
    var statusOut = root.querySelector("[data-force-status]");
    var normalOut = root.querySelector("[data-force-N]");
    var frictionOut = root.querySelector("[data-force-f]");
    var netOut = root.querySelector("[data-force-net]");
    var accelOut = root.querySelector("[data-force-a]");
    var posOut = root.querySelector("[data-force-pos]");

    var animId = null;
    var playing = false;
    var worldHalfWidth = 2;

    function currentState() {
      return computeState(
        parseFloat(massInput.value),
        parseFloat(appliedInput.value),
        parseFloat(muSInput.value),
        Math.min(parseFloat(muKInput.value), parseFloat(muSInput.value))
      );
    }

    function recomputeScale(state) {
      var xEnd = Math.abs(positionAt(DURATION, state).x);
      worldHalfWidth = Math.max(xEnd * 1.15, 1.5);
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

    function drawArrow(ctx, x0, y0, dx, dy, color, label) {
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      var x1 = x0 + dx, y1 = y0 + dy;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      var angle = Math.atan2(dy, dx);
      var head = 7;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - head * Math.cos(angle - Math.PI / 6), y1 - head * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(x1 - head * Math.cos(angle + Math.PI / 6), y1 - head * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
      if (label) {
        ctx.font = "600 11px system-ui, sans-serif";
        var lx = x1 + (dx >= 0 ? 4 : -4 - ctx.measureText(label).width);
        var ly = y1 + (dy < 0 ? -4 : dy > 0 ? 12 : -8);
        ctx.fillText(label, lx, ly);
      }
    }

    function drawScene(t) {
      var dims = resizeCanvas(sceneCanvas, 0.44);
      var ctx = dims.ctx, W = dims.w, H = dims.h;
      ctx.clearRect(0, 0, W, H);

      var state = currentState();
      var groundY = H * 0.66;
      var margin = 28;

      // Ground
      ctx.strokeStyle = "#c7cede";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(margin, groundY);
      ctx.lineTo(W - margin, groundY);
      ctx.stroke();
      // hatching
      ctx.strokeStyle = "#dfe3ec";
      ctx.lineWidth = 1;
      for (var hx = margin; hx < W - margin; hx += 10) {
        ctx.beginPath();
        ctx.moveTo(hx, groundY);
        ctx.lineTo(hx - 6, groundY + 8);
        ctx.stroke();
      }

      var pos = positionAt(t, state);
      var pxPerMeter = (W - 2 * margin) / (2 * worldHalfWidth);
      var boxSize = Math.min(46, (W - 2 * margin) * 0.14);
      var cx = W / 2 + pos.x * pxPerMeter;
      var cy = groundY - boxSize / 2;

      // Box
      ctx.fillStyle = state.moving ? "#eef3fc" : "#fdf3e3";
      ctx.strokeStyle = "#8a93a8";
      ctx.lineWidth = 1.5;
      ctx.fillRect(cx - boxSize / 2, cy - boxSize / 2, boxSize, boxSize);
      ctx.strokeRect(cx - boxSize / 2, cy - boxSize / 2, boxSize, boxSize);

      // Force arrows, scaled to a shared force->pixel factor
      var maxForce = Math.max(state.weight, state.normal, Math.abs(appliedForceValue()), Math.abs(state.friction), 1);
      var pxPerNewton = (boxSize * 1.5) / maxForce;

      drawArrow(ctx, cx, cy, 0, boxSize / 2 + Math.max(state.weight * pxPerNewton, 14), "#5b6472", "W");
      drawArrow(ctx, cx, cy, 0, -(boxSize / 2 + Math.max(state.normal * pxPerNewton, 14)), "#1e7d43", "N");
      var applied = appliedForceValue();
      if (Math.abs(applied) > 0.01) {
        var adx = Math.sign(applied) * Math.max(Math.abs(applied) * pxPerNewton, 16);
        drawArrow(ctx, cx, cy, adx, 0, "#c9722c", "F");
      }
      if (Math.abs(state.friction) > 0.01) {
        var fdx = Math.sign(state.friction) * Math.max(Math.abs(state.friction) * pxPerNewton, 16);
        drawArrow(ctx, cx, cy, fdx, boxSize * 0.15, "#b3261e", "f");
      }

      ctx.font = "600 11px system-ui, sans-serif";
      ctx.fillStyle = "#8a93a8";
      ctx.fillText(state.moving ? "sliding" : "resting", cx - 16, groundY + 20);
    }

    function appliedForceValue() {
      return parseFloat(appliedInput.value);
    }

    function updateReadouts(t) {
      var state = currentState();
      var pos = positionAt(t, state);
      statusOut.textContent = state.moving
        ? "Sliding — kinetic friction opposes the motion"
        : "Locked in place — static friction balances the applied force";
      statusOut.style.color = state.moving ? "var(--color-primary)" : "var(--color-success)";
      normalOut.textContent = state.normal.toFixed(1) + " N";
      frictionOut.textContent = Math.abs(state.friction).toFixed(1) + " N (" + (state.moving ? "kinetic" : "static") + ")";
      netOut.textContent = state.netForce.toFixed(1) + " N";
      accelOut.textContent = state.accel.toFixed(2) + " m/s²";
      posOut.textContent = pos.x.toFixed(2) + " m";
    }

    function redraw() {
      var t = parseFloat(timeInput.value);
      timeOut.textContent = t.toFixed(2) + " s";
      drawScene(t);
      updateReadouts(t);
    }

    function onParamsChanged() {
      var state = currentState();
      recomputeScale(state);
      massOut.textContent = parseFloat(massInput.value).toFixed(0) + " kg";
      appliedOut.textContent = parseFloat(appliedInput.value).toFixed(0) + " N";
      muSOut.textContent = parseFloat(muSInput.value).toFixed(2);
      var clampedMuK = Math.min(parseFloat(muKInput.value), parseFloat(muSInput.value));
      muKInput.value = clampedMuK;
      muKOut.textContent = clampedMuK.toFixed(2);
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

    [massInput, appliedInput, muSInput, muKInput].forEach(function (input) {
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
      massInput.value = 10;
      appliedInput.value = 40;
      muSInput.value = 0.5;
      muKInput.value = 0.35;
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
    document.querySelectorAll("[data-force-sim]").forEach(initSim);
  });
})();
