/* =====================================================================
 * background.js
 * Fondo animado: portadores de carga que viajan sobre "líneas de flujo"
 * sinusoidales. La amplitud de las líneas se modula con la corriente
 * instantánea del inductor que entrega el motor de simulación, de modo
 * que el fondo respira al ritmo de la señal de 60 Hz (en cámara lenta).
 * ===================================================================== */
(function (global) {
  'use strict';

  class FluxBackground {
    constructor(canvas, getSignal) {
      this.c = canvas; this.ctx = canvas.getContext('2d');
      this.getSignal = getSignal || (() => 0);
      this.particles = [];
      this.lines = 9;
      this.time = 0;
      this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.resize();
      window.addEventListener('resize', () => this.resize());
      this.seed();
    }

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.w = window.innerWidth; this.h = window.innerHeight;
      this.c.width = this.w * dpr; this.c.height = this.h * dpr;
      this.c.style.width = this.w + 'px'; this.c.style.height = this.h + 'px';
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    seed() {
      this.particles = [];
      const n = Math.round(Math.min(260, (this.w * this.h) / 7000));
      for (let i = 0; i < n; i++) {
        this.particles.push({
          line: Math.floor(Math.random() * this.lines),
          x: Math.random() * this.w,
          v: 0.35 + Math.random() * 1.1,
          r: 0.6 + Math.random() * 1.6,
          hue: Math.random() < 0.72 ? 0 : 1,
          tw: Math.random() * Math.PI * 2
        });
      }
    }

    yOf(line, x, amp) {
      const base = (this.h / (this.lines + 1)) * (line + 1);
      const k = (2 * Math.PI) / (this.w * 0.62);
      const ph = line * 0.7 + this.time * 0.35;
      return base + Math.sin(k * x + ph) * amp * (0.55 + 0.45 * Math.sin(line * 1.3));
    }

    frame(dtSec) {
      const ctx = this.ctx;
      this.time += this.reduced ? 0 : dtSec;
      const s = this.getSignal();              // −1 … 1
      const amp = 18 + 34 * Math.abs(s);

      ctx.clearRect(0, 0, this.w, this.h);

      // retícula tenue tipo osciloscopio
      ctx.strokeStyle = 'rgba(120,170,220,0.045)';
      ctx.lineWidth = 1;
      const g = 48;
      ctx.beginPath();
      for (let x = (this.time * 6) % g; x < this.w; x += g) { ctx.moveTo(x, 0); ctx.lineTo(x, this.h); }
      for (let y = 0; y < this.h; y += g) { ctx.moveTo(0, y); ctx.lineTo(this.w, y); }
      ctx.stroke();

      // líneas de flujo
      for (let l = 0; l < this.lines; l++) {
        ctx.beginPath();
        for (let x = 0; x <= this.w; x += 12) {
          const y = this.yOf(l, x, amp);
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = l % 3 === 0 ? 'rgba(57,229,198,0.17)' : 'rgba(106,183,255,0.11)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      // portadores de carga
      const dir = s >= 0 ? 1 : -1;
      for (const p of this.particles) {
        if (!this.reduced) p.x += dir * p.v * (0.4 + 1.6 * Math.abs(s)) * dtSec * 60;
        if (p.x > this.w + 10) p.x = -10; if (p.x < -10) p.x = this.w + 10;
        const y = this.yOf(p.line, p.x, amp);
        p.tw += dtSec * 2;
        const a = 0.5 + 0.4 * Math.sin(p.tw);
        const col = p.hue ? `rgba(255,181,71,${a})` : `rgba(57,229,198,${a})`;
        ctx.beginPath();
        ctx.fillStyle = col;
        ctx.shadowColor = col; ctx.shadowBlur = 8;
        ctx.arc(p.x, y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    }
  }

  global.FluxBackground = FluxBackground;
})(window);
