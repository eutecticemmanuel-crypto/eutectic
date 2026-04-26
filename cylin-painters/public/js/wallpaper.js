/**
 * ============================================
 * Cylin Painters - Live Wallpaper (Canvas)
 * ============================================
 */

(function () {
  const canvas = document.getElementById('wallpaperCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let width, height;
  let particles = [];
  let blobs = [];
  let brushStrokes = [];
  let mouse = { x: 0, y: 0, active: false };

  const CONFIG = {
    particleCount: 60,
    blobCount: 5,
    strokeCount: 4,
    colors: [
      '#1a365d',
      '#2c5282',
      '#d69e2e',
      '#ecc94b',
      '#0f172a',
      '#64748b',
    ],
    bgColor: '#0f172a',
  };

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }

  function randomRange(min, max) {
    return Math.random() * (max - min) + min;
  }

  function randomColor() {
    return CONFIG.colors[Math.floor(Math.random() * CONFIG.colors.length)];
  }

  /* ---------- Particle ---------- */
  class Particle {
    constructor() {
      this.reset();
    }
    reset() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.size = randomRange(2, 8);
      this.speedX = randomRange(-0.8, 0.8);
      this.speedY = randomRange(-0.8, 0.8);
      this.color = randomColor();
      this.alpha = randomRange(0.3, 0.8);
      this.life = 0;
      this.maxLife = randomRange(200, 500);
    }
    update() {
      this.x += this.speedX;
      this.y += this.speedY;
      this.life++;

      if (mouse.active) {
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150) {
          const force = (150 - dist) / 150;
          this.speedX += (dx / dist) * force * 0.02;
          this.speedY += (dy / dist) * force * 0.02;
        }
      }

      this.speedX *= 0.99;
      this.speedY *= 0.99;
      this.alpha = 0.3 + Math.sin(this.life * 0.02) * 0.3;

      if (
        this.x < -50 ||
        this.x > width + 50 ||
        this.y < -50 ||
        this.y > height + 50 ||
        this.life > this.maxLife
      ) {
        this.reset();
      }
    }
    draw() {
      ctx.save();
      ctx.globalAlpha = this.alpha;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = this.alpha * 0.3;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /* ---------- Blob ---------- */
  class Blob {
    constructor() {
      this.reset();
    }
    reset() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.radius = randomRange(80, 200);
      this.color = randomColor();
      this.alpha = randomRange(0.05, 0.15);
      this.speedX = randomRange(-0.3, 0.3);
      this.speedY = randomRange(-0.3, 0.3);
      this.angle = Math.random() * Math.PI * 2;
      this.spin = randomRange(-0.002, 0.002);
      this.points = [];
      const numPoints = 8;
      for (let i = 0; i < numPoints; i++) {
        this.points.push(randomRange(0.7, 1.3));
      }
    }
    update() {
      this.x += this.speedX;
      this.y += this.speedY;
      this.angle += this.spin;
      if (this.x < -this.radius) this.x = width + this.radius;
      if (this.x > width + this.radius) this.x = -this.radius;
      if (this.y < -this.radius) this.y = height + this.radius;
      if (this.y > height + this.radius) this.y = -this.radius;
    }
    draw() {
      ctx.save();
      ctx.globalAlpha = this.alpha;
      ctx.fillStyle = this.color;
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      ctx.beginPath();
      const numPoints = this.points.length;
      for (let i = 0; i <= numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        const r = this.radius * this.points[i % numPoints];
        const px = Math.cos(angle) * r;
        const py = Math.sin(angle) * r;
        if (i === 0) {
          ctx.moveTo(px, py);
        } else {
          const prevAngle = ((i - 1) / numPoints) * Math.PI * 2;
          const prevR = this.radius * this.points[(i - 1) % numPoints];
          const prevPx = Math.cos(prevAngle) * prevR;
          const prevPy = Math.sin(prevAngle) * prevR;
          const cpX = (prevPx + px) / 2;
          const cpY = (prevPy + py) / 2;
          ctx.quadraticCurveTo(prevPx, prevPy, cpX, cpY);
        }
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  /* ---------- Brush Stroke ---------- */
  class BrushStroke {
    constructor() {
      this.reset();
    }
    reset() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.width = randomRange(100, 300);
      this.height = randomRange(2, 6);
      this.angle = Math.random() * Math.PI * 2;
      this.color = randomColor();
      this.alpha = randomRange(0.05, 0.2);
      this.speedX = Math.cos(this.angle) * randomRange(0.1, 0.4);
      this.speedY = Math.sin(this.angle) * randomRange(0.1, 0.4);
      this.life = 0;
      this.maxLife = randomRange(300, 600);
    }
    update() {
      this.x += this.speedX;
      this.y += this.speedY;
      this.life++;
      if (
        this.x < -200 ||
        this.x > width + 200 ||
        this.y < -200 ||
        this.y > height + 200 ||
        this.life > this.maxLife
      ) {
        this.reset();
      }
    }
    draw() {
      ctx.save();
      ctx.globalAlpha = this.alpha;
      ctx.fillStyle = this.color;
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      ctx.beginPath();
      ctx.ellipse(0, 0, this.width / 2, this.height / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /* ---------- Init & Loop ---------- */
  function init() {
    resize();
    for (let i = 0; i < CONFIG.particleCount; i++) particles.push(new Particle());
    for (let i = 0; i < CONFIG.blobCount; i++) blobs.push(new Blob());
    for (let i = 0; i < CONFIG.strokeCount; i++) brushStrokes.push(new BrushStroke());

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    });
    window.addEventListener('mouseleave', () => {
      mouse.active = false;
    });

    animate();
  }

  function animate() {
    ctx.fillStyle = CONFIG.bgColor;
    ctx.fillRect(0, 0, width, height);

    blobs.forEach((b) => {
      b.update();
      b.draw();
    });

    brushStrokes.forEach((s) => {
      s.update();
      s.draw();
    });

    particles.forEach((p) => {
      p.update();
      p.draw();
    });

    requestAnimationFrame(animate);
  }

  init();
})();

