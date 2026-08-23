// Unit Circle Explorer — drag the point around the circle (or use the angle
// slider) to see how the angle in degrees/radians relates to (cos θ, sin θ)
// and the six trig function values, live.
(function () {
  var SPECIAL_DEG = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330, 360];

  function fmt(n, d) {
    if (!isFinite(n)) return "undefined";
    return n.toFixed(d == null ? 3 : d);
  }

  function niceRadians(deg) {
    // Express common angles as exact pi-fractions for the readout.
    var g = function (a, b) {
      return b === 0 ? a : g(b, a % b);
    };
    var num = Math.round(deg);
    var den = 180;
    var divisor = g(num, den) || 1;
    num = num / divisor;
    den = den / divisor;
    if (num === 0) return "0";
    var sign = "";
    if (num < 0) { sign = "-"; num = -num; }
    var numStr = num === 1 ? "" : String(num);
    if (den === 1) return sign + numStr + "π";
    return sign + numStr + "π/" + den;
  }

  function initSim(wrap) {
    var canvas = wrap.querySelector("[data-uc-canvas]");
    var ctx = canvas.getContext("2d");
    var slider = wrap.querySelector("[data-uc-angle]");
    var out = wrap.querySelector("[data-uc-angle-out]");
    var snapBox = wrap.querySelector("[data-uc-snap]");
    var degEl = wrap.querySelector("[data-uc-deg]");
    var radEl = wrap.querySelector("[data-uc-rad]");
    var coordEl = wrap.querySelector("[data-uc-coord]");
    var sinEl = wrap.querySelector("[data-uc-sin]");
    var cosEl = wrap.querySelector("[data-uc-cos]");
    var tanEl = wrap.querySelector("[data-uc-tan]");
    var refEl = wrap.querySelector("[data-uc-ref]");
    var quadEl = wrap.querySelector("[data-uc-quad]");

    var angleDeg = 45;
    var dragging = false;

    function cssSize() {
      var w = canvas.clientWidth || 320;
      canvas.width = w * (window.devicePixelRatio || 1);
      canvas.height = w * (window.devicePixelRatio || 1);
      ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
      return w;
    }

    function quadrant(deg) {
      var n = ((deg % 360) + 360) % 360;
      if (n === 0 || n === 90 || n === 180 || n === 270) return "axis (quadrantal angle)";
      if (n < 90) return "I";
      if (n < 180) return "II";
      if (n < 270) return "III";
      return "IV";
    }

    function referenceAngle(deg) {
      var n = ((deg % 360) + 360) % 360;
      if (n <= 90) return n;
      if (n <= 180) return 180 - n;
      if (n <= 270) return n - 180;
      return 360 - n;
    }

    function draw() {
      var size = cssSize();
      var cx = size / 2, cy = size / 2;
      var r = size * 0.38;
      ctx.clearRect(0, 0, size, size);

      // axes
      ctx.strokeStyle = "#c7ccd6";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, cy); ctx.lineTo(size, cy);
      ctx.moveTo(cx, 0); ctx.lineTo(cx, size);
      ctx.stroke();

      // circle
      ctx.strokeStyle = "#2f5d9f";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      var rad = (angleDeg * Math.PI) / 180;
      var px = cx + r * Math.cos(rad);
      var py = cy - r * Math.sin(rad);

      // radius line
      ctx.strokeStyle = "#2f5d9f";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(px, py);
      ctx.stroke();

      // cos (x) and sin (y) drop lines
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "#b3261e";
      ctx.beginPath();
      ctx.moveTo(px, py); ctx.lineTo(px, cy);
      ctx.stroke();
      ctx.strokeStyle = "#1e7d43";
      ctx.beginPath();
      ctx.moveTo(px, py); ctx.lineTo(cx, py);
      ctx.stroke();
      ctx.setLineDash([]);

      // angle arc
      ctx.strokeStyle = "#8a5cf6";
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.22, -rad, 0, angleDeg < 0);
      ctx.stroke();

      // point
      ctx.fillStyle = "#2f5d9f";
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fill();

      // labels
      ctx.fillStyle = "#1f2430";
      ctx.font = "12px system-ui, sans-serif";
      ctx.fillText("(cos θ, sin θ)", px + 10, py - 10);
      ctx.fillText("1", cx + r + 6, cy + 4);
      ctx.fillText("-1", cx - r - 18, cy + 4);
      ctx.fillText("1", cx - 12, cy - r - 6);
      ctx.fillText("-1", cx - 16, cy + r + 14);
    }

    function update() {
      var rad = (angleDeg * Math.PI) / 180;
      var s = Math.sin(rad), c = Math.cos(rad);
      var t = Math.abs(c) < 1e-9 ? Infinity : s / c;

      slider.value = angleDeg;
      out.textContent = fmt(angleDeg, 1) + "°";
      degEl.textContent = fmt(angleDeg, 1) + "°";
      radEl.textContent = niceRadians(angleDeg) + "  (" + fmt(rad, 3) + " rad)";
      coordEl.textContent = "(" + fmt(c) + ", " + fmt(s) + ")";
      sinEl.textContent = fmt(s);
      cosEl.textContent = fmt(c);
      tanEl.textContent = t === Infinity ? "undefined" : fmt(t);
      refEl.textContent = fmt(referenceAngle(angleDeg), 1) + "°";
      quadEl.textContent = quadrant(angleDeg);

      draw();
    }

    slider.addEventListener("input", function () {
      angleDeg = parseFloat(slider.value);
      update();
    });

    snapBox.addEventListener("change", function () {
      if (snapBox.checked) {
        var closest = SPECIAL_DEG.reduce(function (best, d) {
          return Math.abs(d - angleDeg) < Math.abs(best - angleDeg) ? d : best;
        }, SPECIAL_DEG[0]);
        angleDeg = closest;
        update();
      }
    });

    function angleFromEvent(evt) {
      var rect = canvas.getBoundingClientRect();
      var clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
      var clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;
      var x = clientX - rect.left - rect.width / 2;
      var y = rect.height / 2 - (clientY - rect.top);
      var deg = (Math.atan2(y, x) * 180) / Math.PI;
      if (deg < 0) deg += 360;
      if (snapBox.checked) {
        deg = SPECIAL_DEG.reduce(function (best, d) {
          return Math.abs(d - deg) < Math.abs(best - deg) ? d : best;
        }, SPECIAL_DEG[0]);
      }
      return deg;
    }

    function onDown(evt) {
      dragging = true;
      angleDeg = angleFromEvent(evt);
      update();
    }
    function onMove(evt) {
      if (!dragging) return;
      evt.preventDefault();
      angleDeg = angleFromEvent(evt);
      update();
    }
    function onUp() { dragging = false; }

    canvas.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    canvas.addEventListener("touchstart", onDown, { passive: true });
    canvas.addEventListener("touchmove", onMove, { passive: false });
    canvas.addEventListener("touchend", onUp);

    window.addEventListener("resize", draw);
    update();
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-uc-sim]").forEach(initSim);
  });
})();
