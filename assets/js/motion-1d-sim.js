// One-dimensional motion visualizer: position/velocity/acceleration vs.
// time for two scenarios — a car with constant acceleration on a straight
// road, and a ball thrown straight up or down under gravity. Drag the time
// slider to scrub to any instant, or hit Play to animate through it.
(function () {
  var GRAVITY = { earth: 9.81, moon: 1.62, mars: 3.72 };
  var CAR_DURATION = 10; // seconds — fixed window for the car scenario
  var BALL_HEIGHT = 20; // meters — fixed starting height for the ball scenario
  var SAMPLES = 140;

  function carKinematics(t, v0, a) {
    return { x: v0 * t + 0.5 * a * t * t, v: v0 + a * t, a: a };
  }

  function ballDuration(v0, g) {
    // Solve 0 = H + v0*t - 0.5*g*t^2 for the positive root (time to reach the ground).
    var disc = Math.sqrt(v0 * v0 + 2 * g * BALL_HEIGHT);
    return (v0 + disc) / g;
  }

  function ballKinematics(t, v0, g, duration) {
    var clampedT = Math.min(t, duration);
    var x = BALL_HEIGHT + v0 * clampedT - 0.5 * g * clampedT * clampedT;
    if (x < 0) x = 0;
    return { x: x, v: v0 - g * clampedT, a: -g };
  }

  function initSim(root) {
    var trackCanvas = root.querySelector("[data-motion1d-track]");
    var graphCanvases = {
      position: root.querySelector('[data-motion1d-graph="position"]'),
      velocity: root.querySelector('[data-motion1d-graph="velocity"]'),
      acceleration: root.querySelector('[data-motion1d-graph="acceleration"]')
    };
    var modeButtons = root.querySelectorAll("[data-motion1d-mode]");
    var velocityInput = root.querySelector("[data-motion1d-velocity]");
    var velocityOut = root.querySelector("[data-motion1d-velocity-out]");
    var accelControl = root.querySelector('[data-motion1d-control="acceleration-car"]');
    var accelInput = root.querySelector("[data-motion1d-accel]");
    var accelOut = root.querySelector("[data-motion1d-accel-out]");
    var gravityControl = root.querySelector('[data-motion1d-control="gravity-ball"]');
    var gravitySelect = root.querySelector("[data-motion1d-gravity]");
    var timeInput = root.querySelector("[data-motion1d-time]");
    var timeOut = root.querySelector("[data-motion1d-time-out]");
    var playBtn = root.querySelector("[data-motion1d-play]");
    var resetBtn = root.querySelector("[data-motion1d-reset]");
    var xOut = root.querySelector("[data-motion1d-x]");
    var vOut = root.querySelector("[data-motion1d-v]");
    var aOut = root.querySelector("[data-motion1d-a]");

    var mode = "car";
    var duration = CAR_DURATION;
    var curve = []; // sampled {t, x, v, a} across [0, duration]
    var xRange, vRange, aRange;
    var animId = null;
    var playing = false;

    function labelForMode() {
      return mode === "car" ? "Position" : "Height";
    }

    function kinematicsAt(t) {
      if (mode === "car") {
        return carKinematics(t, parseFloat(velocityInput.value), parseFloat(accelInput.value));
      }
      var g = GRAVITY[gravitySelect.value];
      return ballKinematics(t, parseFloat(velocityInput.value), g, duration);
    }

    function rangeWithZero(values) {
      var min = Math.min.apply(null, values.concat([0]));
      var max = Math.max.apply(null, values.concat([0]));
      var pad = (max - min) * 0.12 || 1;
      return { min: min - pad, max: max + pad };
    }

    function recompute() {
      if (mode === "car") {
        duration = CAR_DURATION;
      } else {
        var g = GRAVITY[gravitySelect.value];
        duration = ballDuration(parseFloat(velocityInput.value), g);
      }
      duration = Math.round(duration * 100) / 100; // keep the slider's max/step at clean 2-decimal values
      timeInput.min = 0;
      timeInput.max = duration;
      timeInput.step = Math.max(Math.round((duration / 200) * 1000) / 1000, 0.01);

      curve = [];
      var xs = [], vs = [], as = [];
      for (var i = 0; i <= SAMPLES; i++) {
        var t = (duration * i) / SAMPLES;
        var k = kinematicsAt(t);
        curve.push({ t: t, x: k.x, v: k.v, a: k.a });
        xs.push(k.x); vs.push(k.v); as.push(k.a);
      }
      xRange = rangeWithZero(xs);
      vRange = rangeWithZero(vs);
      aRange = rangeWithZero(as);
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

    function drawTrack(t) {
      var dims = resizeCanvas(trackCanvas, 0.22);
      var ctx = dims.ctx, W = dims.w, H = dims.h;
      ctx.clearRect(0, 0, W, H);
      var margin = 24;
      var k = kinematicsAt(t);

      ctx.fillStyle = "#8a93a8";
      ctx.font = "600 11px system-ui, sans-serif";
      ctx.textBaseline = "top";

      if (mode === "car") {
        var y = H / 2;
        ctx.strokeStyle = "#c7cede";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(margin, y);
        ctx.lineTo(W - margin, y);
        ctx.stroke();

        var scale = (W - margin * 2) / (xRange.max - xRange.min);
        var px = margin + (k.x - xRange.min) * scale;
        ctx.fillStyle = "#2f5d9f";
        ctx.font = "20px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("🚗", px, y - 20);
        ctx.beginPath();
        ctx.arc(px, y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.textAlign = "left";
        ctx.fillStyle = "#8a93a8";
        ctx.font = "600 11px system-ui, sans-serif";
        ctx.fillText("Straight road (car icon shows position)", margin, 4);
      } else {
        var x = W / 2;
        ctx.strokeStyle = "#c7cede";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, margin);
        ctx.lineTo(x, H - margin);
        ctx.stroke();
        // ground line
        ctx.strokeStyle = "#e2b93b";
        ctx.beginPath();
        ctx.moveTo(margin, H - margin);
        ctx.lineTo(W - margin, H - margin);
        ctx.stroke();

        var scaleY = (H - margin * 2) / (xRange.max - xRange.min);
        var py = (H - margin) - (k.x - xRange.min) * scaleY;
        ctx.fillStyle = "#2f5d9f";
        ctx.beginPath();
        ctx.arc(x, py, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#8a93a8";
        ctx.fillText("Height above ground (ball icon shows position)", margin, 4);
      }
    }

    function drawGraph(key, title, unit, range) {
      var canvas = graphCanvases[key];
      var dims = resizeCanvas(canvas, 0.32);
      var ctx = dims.ctx, W = dims.w, H = dims.h;
      ctx.clearRect(0, 0, W, H);

      var marginL = 34, marginR = 10, marginT = 20, marginB = 18;
      var plotW = W - marginL - marginR;
      var plotH = H - marginT - marginB;

      function xPix(t) { return marginL + (t / duration) * plotW; }
      function yPix(v) { return marginT + (1 - (v - range.min) / (range.max - range.min)) * plotH; }

      // gridlines + labels (horizontal: value; vertical: time)
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
        ctx.fillText(v.toFixed(1), marginL - 5, y);
      });
      var tTicks = 4;
      for (var i = 0; i <= tTicks; i++) {
        var t = (duration * i) / tTicks;
        var x = xPix(t);
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(t.toFixed(1) + "s", x, H - marginB + 3);
      }

      // zero line, emphasized
      if (range.min < 0 && range.max > 0) {
        ctx.strokeStyle = "#c7cede";
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(marginL, yPix(0));
        ctx.lineTo(W - marginR, yPix(0));
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // curve
      ctx.strokeStyle = "#2f5d9f";
      ctx.lineWidth = 2;
      ctx.beginPath();
      curve.forEach(function (pt, i) {
        var x = xPix(pt.t), y = yPix(pt[key === "acceleration" ? "a" : key === "velocity" ? "v" : "x"]);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // current-time marker
      var curT = parseFloat(timeInput.value);
      var k = kinematicsAt(curT);
      var curVal = key === "acceleration" ? k.a : key === "velocity" ? k.v : k.x;
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

      // title
      ctx.fillStyle = "#1f2430";
      ctx.font = "600 11px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(title + " (" + unit + ")", marginL, 2);
    }

    function redraw() {
      var t = parseFloat(timeInput.value);
      drawTrack(t);
      drawGraph("position", labelForMode(), "m", xRange);
      drawGraph("velocity", "Velocity", "m/s", vRange);
      drawGraph("acceleration", "Acceleration", "m/s²", aRange);

      var k = kinematicsAt(t);
      xOut.textContent = k.x.toFixed(1) + " m";
      vOut.textContent = k.v.toFixed(1) + " m/s";
      aOut.textContent = k.a.toFixed(2) + " m/s²";
      timeOut.textContent = t.toFixed(2) + " s";
    }

    function onParamsChanged() {
      recompute();
      timeInput.value = 0;
      redraw();
    }

    function setMode(newMode) {
      mode = newMode;
      modeButtons.forEach(function (btn) {
        btn.classList.toggle("active", btn.getAttribute("data-motion1d-mode") === mode);
      });
      if (accelControl) accelControl.style.display = mode === "car" ? "" : "none";
      if (gravityControl) gravityControl.style.display = mode === "ball" ? "" : "none";
      velocityInput.value = mode === "car" ? 10 : 15;
      velocityOut.textContent = velocityInput.value + " m/s";
      onParamsChanged();
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

    modeButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        stopPlaying();
        setMode(btn.getAttribute("data-motion1d-mode"));
      });
    });
    velocityInput.addEventListener("input", function () {
      velocityOut.textContent = velocityInput.value + " m/s";
      stopPlaying();
      onParamsChanged();
    });
    if (accelInput) {
      accelInput.addEventListener("input", function () {
        accelOut.textContent = parseFloat(accelInput.value).toFixed(1) + " m/s²";
        stopPlaying();
        onParamsChanged();
      });
    }
    if (gravitySelect) {
      gravitySelect.addEventListener("change", function () {
        stopPlaying();
        onParamsChanged();
      });
    }
    timeInput.addEventListener("input", function () {
      if (!playing) redraw();
    });
    playBtn.addEventListener("click", play);
    resetBtn.addEventListener("click", function () {
      stopPlaying();
      velocityInput.value = mode === "car" ? 10 : 15;
      velocityOut.textContent = velocityInput.value + " m/s";
      if (accelInput) { accelInput.value = 1; accelOut.textContent = "1.0 m/s²"; }
      if (gravitySelect) gravitySelect.value = "earth";
      onParamsChanged();
    });
    window.addEventListener("resize", redraw);

    setMode("car");
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-motion1d-sim]").forEach(initSim);
  });
})();
