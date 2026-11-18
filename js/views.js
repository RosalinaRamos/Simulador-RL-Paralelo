/* =====================================================================
 * views.js
 * Vistas gráficas: esquema animado del circuito (estilo Falstad),
 * osciloscopios de barrido y diagrama fasorial.
 * ===================================================================== */
(function (global) {
  'use strict';

  const fmt = (x, d = 2) => (isFinite(x) ? x.toFixed(d).replace('.', ',') : '—');

  function fitCanvas(c, lw, lh) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = c.getBoundingClientRect();
    if (c.width !== Math.round(r.width * dpr) || c.height !== Math.round(r.height * dpr)) {
      c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
    }
    const ctx = c.getContext('2d');
    const s = Math.min(r.width / lw, r.height / lh);
    const ox = (r.width - lw * s) / 2, oy = (r.height - lh * s) / 2;
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * oy);
    return { ctx, s, ox, oy, w: r.width, h: r.height };
  }

  /* Color de tensión al estilo Falstad: gris = 0 V, verde = +, rojo = − */
  function vColor(v, vmax) {
    let k = Math.max(-1, Math.min(1, v / (vmax || 1)));
    const g = 128;
    if (k >= 0) return `rgb(${Math.round(g - g * k)},${Math.round(g + (255 - g) * k)},${Math.round(g - g * k)})`;
    k = -k; return `rgb(${Math.round(g + (255 - g) * k)},${Math.round(g - g * k)},${Math.round(g - g * k)})`;
  }

  /* ------------------------------------------------------------------ */
  class CircuitView {
    constructor(canvas, onPick) {
      this.c = canvas; this.onPick = onPick;
      this.LW = 860; this.LH = 470;
      this.X = { S: 190, L: 470, R: 720 }; this.Y = { T: 80, B: 380 };
      this.off = { S: 0, T1: 0, L: 0, T2: 0, R: 0 };
      this.hover = null;
      this.hit = [
        { id: 'source', x: this.X.S - 40, y: 190, w: 80, h: 80 },
        { id: 'inductor', x: this.X.L - 30, y: 160, w: 60, h: 140 },
        { id: 'resistor', x: this.X.R - 30, y: 170, w: 60, h: 120 }
      ];
      canvas.addEventListener('mousemove', (e) => { this.hover = this.pick(e); canvas.style.cursor = this.hover ? 'pointer' : 'default'; });
      canvas.addEventListener('mouseleave', () => { this.hover = null; });
      canvas.addEventListener('click', (e) => { const h = this.pick(e); if (h && this.onPick) this.onPick(h); });
    }

    pick(e) {
      const r = this.c.getBoundingClientRect();
      const s = Math.min(r.width / this.LW, r.height / this.LH);
      const ox = (r.width - this.LW * s) / 2, oy = (r.height - this.LH * s) / 2;
      const x = (e.clientX - r.left - ox) / s, y = (e.clientY - r.top - oy) / s;
      const h = this.hit.find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
      return h ? h.id : null;
    }

    advanceDots(eng, speed, dtSec) {
      const k = speed * dtSec * 60;
      this.off.S += eng.is * k;  this.off.T1 += eng.is * k;
      this.off.L += eng.iL * k;  this.off.T2 += eng.iR * k; this.off.R += eng.iR * k;
    }

    draw(eng, th, speed, dtSec) {
      const { ctx } = fitCanvas(this.c, this.LW, this.LH);
      const X = this.X, Y = this.Y;
      this.advanceDots(eng, speed, dtSec);
      ctx.clearRect(-2000, -2000, 6000, 6000);

      const vmax = th.Vpk * 1.05;
      const top = vColor(eng.v, vmax), bot = vColor(0, vmax);

      const wire = (x1, y1, x2, y2, col) => {
        ctx.strokeStyle = col; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      };
      const gradV = (x, y1, y2) => {
        const g = ctx.createLinearGradient(x, y1, x, y2); g.addColorStop(0, top); g.addColorStop(1, bot); return g;
      };

      // conductores
      wire(X.S, Y.T, X.R, Y.T, top);
      wire(X.S, Y.B, X.R, Y.B, bot);
      wire(X.S, Y.T, X.S, 200, top); wire(X.S, 260, X.S, Y.B, bot);
      wire(X.L, Y.T, X.L, 170, top); wire(X.L, 290, X.L, Y.B, bot);
      wire(X.R, Y.T, X.R, 180, top); wire(X.R, 280, X.R, Y.B, bot);

      // fuente de corriente
      const hl = (id) => this.hover === id;
      ctx.lineWidth = 3; ctx.strokeStyle = gradV(X.S, 200, 260);
      ctx.beginPath(); ctx.arc(X.S, 230, 30, 0, Math.PI * 2); ctx.stroke();
      if (hl('source')) { ctx.strokeStyle = 'rgba(120,200,255,.9)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(X.S, 230, 36, 0, Math.PI * 2); ctx.stroke(); }
      // flecha + onda
      ctx.strokeStyle = '#e8eef5'; ctx.fillStyle = '#e8eef5'; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(X.S, 250); ctx.lineTo(X.S, 212); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(X.S, 204); ctx.lineTo(X.S - 7, 216); ctx.lineTo(X.S + 7, 216); ctx.closePath(); ctx.fill();
      ctx.lineWidth = 1.6; ctx.beginPath();
      for (let i = 0; i <= 20; i++) { const xx = X.S - 22 + i * 1.1, yy = 238 + 4 * Math.sin(i / 20 * Math.PI * 2); i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); }
      ctx.stroke();

      // inductor (bobina de 4 espiras, vista Falstad)
      ctx.strokeStyle = gradV(X.L, 170, 290); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(X.L, 170);
      for (let i = 0; i < 4; i++) { const yc = 185 + i * 30; ctx.arc(X.L, yc, 15, -Math.PI / 2, Math.PI / 2, false); }
      ctx.lineTo(X.L, 290); ctx.stroke();
      if (hl('inductor')) { ctx.strokeStyle = 'rgba(120,200,255,.9)'; ctx.lineWidth = 1.5; ctx.strokeRect(X.L - 26, 162, 52, 136); }

      // resistor (caja, norma IEC como en la captura de referencia)
      ctx.strokeStyle = gradV(X.R, 180, 280); ctx.lineWidth = 3;
      ctx.strokeRect(X.R - 13, 185, 26, 90);
      if (hl('resistor')) { ctx.strokeStyle = 'rgba(120,200,255,.9)'; ctx.lineWidth = 1.5; ctx.strokeRect(X.R - 20, 178, 40, 104); }

      // tierra
      ctx.strokeStyle = bot; ctx.lineWidth = 3;
      wire(X.S, Y.B, X.S, Y.B + 26, bot);
      [[22, 0], [14, 7], [6, 14]].forEach(([w, d]) => { ctx.beginPath(); ctx.moveTo(X.S - w, Y.B + 26 + d); ctx.lineTo(X.S + w, Y.B + 26 + d); ctx.stroke(); });

      // nodos
      ctx.fillStyle = '#fff';
      [[X.L, Y.T], [X.L, Y.B]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill(); });

      // puntos de corriente (amarillos)
      const dots = (x1, y1, x2, y2, off) => {
        const L = Math.hypot(x2 - x1, y2 - y1), sp = 16;
        let o = ((off % sp) + sp) % sp;
        ctx.fillStyle = '#ffeb3b';
        for (let d = o; d < L; d += sp) {
          const x = x1 + (x2 - x1) * d / L, y = y1 + (y2 - y1) * d / L;
          ctx.fillRect(x - 2.4, y - 2.4, 4.8, 4.8);
        }
      };
      // trayectorias en sentido positivo de cada corriente
      dots(X.S, Y.B, X.S, Y.T, this.off.S);
      dots(X.S, Y.T, X.L, Y.T, this.off.T1);
      dots(X.L, Y.T, X.L, Y.B, this.off.L);
      dots(X.L, Y.B, X.S, Y.B, this.off.T1);
      dots(X.L, Y.T, X.R, Y.T, this.off.T2);
      dots(X.R, Y.T, X.R, Y.B, this.off.R);
      dots(X.R, Y.B, X.L, Y.B, this.off.R);

      // rótulos
      ctx.fillStyle = '#e8eef5'; ctx.font = '600 17px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${fmt(eng.p.Irms, 2)} A ef`, X.S - 44, 222);
      ctx.fillStyle = '#8fa3b8'; ctx.font = '14px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(`${fmt(eng.p.f, 0)} Hz`, X.S - 44, 244);
      ctx.textAlign = 'left'; ctx.fillStyle = '#e8eef5'; ctx.font = '600 17px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(`${fmt(eng.p.L * 1000, 2)} mH`, X.L + 26, 236);
      ctx.fillText(`${fmt(eng.p.R, 0)} Ω`, X.R + 24, 236);

      // amperímetros virtuales
      const tag = (x, y, label, val, col) => {
        ctx.font = '13px "Segoe UI", system-ui, sans-serif'; ctx.textAlign = 'left';
        ctx.fillStyle = col; ctx.fillText(label, x, y);
        ctx.fillStyle = '#e8eef5'; ctx.fillText(val, x, y + 17);
      };
      tag(X.S + 14, Y.T - 30, 'iₛ(t)', `${fmt(eng.is, 3)} A`, '#ffb547');
      tag(X.L + 14, Y.T - 30, 'v(t)', `${fmt(eng.v, 2)} V`, '#39e5c6');
      tag(X.L + 26, 330, 'i_L(t)', `${fmt(eng.iL, 3)} A`, '#ff5c8a');
      tag(X.R + 24, 330, 'i_R(t)', `${fmt(eng.iR, 4)} A`, '#6ab7ff');

      ctx.textAlign = 'left'; ctx.fillStyle = '#5f7389'; ctx.font = '12px "Segoe UI", system-ui, sans-serif';
      ctx.fillText('Haga clic sobre un componente para editar su valor', 18, this.LH - 14);
    }
  }

  /* ------------------------------------------------------------------ */
  class Scope {
    /* traces: [{key, color, label, unit, scale?}] */
    constructor(canvas, traces, title) { this.c = canvas; this.traces = traces; this.title = title; }

    draw(eng, periods) {
      const r = this.c.getBoundingClientRect();
      const { ctx } = fitCanvas(this.c, r.width, r.height);
      const W = r.width, H = r.height;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#05080c'; ctx.fillRect(0, 0, W, H);

      // retícula
      ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 1; i < 10; i++) { const x = (W * i) / 10; ctx.moveTo(x, 34); ctx.lineTo(x, H - 6); }
      for (let i = 1; i < 6; i++) { const y = 34 + ((H - 40) * i) / 6; ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      const y0 = 34 + (H - 40) / 2;
      ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(W, y0); ctx.stroke();

      const n = Math.round(periods / eng.p.f / eng.dt);
      const stride = Math.max(1, Math.floor(n / (W * 1.5)));
      const d = eng.window(n, stride);
      const N = d.t.length; if (N < 2) return;

      let lx = 8;
      this.traces.forEach((tr) => {
        const arr = d[tr.key];
        let mx = 0; for (const x of arr) mx = Math.max(mx, Math.abs(x));
        const sc = tr.fixed || mx * 1.08 || 1;
        ctx.strokeStyle = tr.color; ctx.lineWidth = 1.8;
        ctx.beginPath();
        for (let i = 0; i < N; i++) {
          const x = (i / (n / stride - 1)) * W + (W - (N / (n / stride)) * W);
          const y = y0 - (arr[i] / sc) * ((H - 44) / 2);
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
        ctx.font = '600 12px "Segoe UI", system-ui, sans-serif'; ctx.fillStyle = tr.color; ctx.textAlign = 'left';
        const txt = `Max=${fmt(mx, tr.dec ?? 3)} ${tr.unit}`;
        ctx.fillText(txt, lx, 14);
        ctx.font = '12px "Segoe UI", system-ui, sans-serif'; ctx.fillStyle = '#c9d6e3';
        ctx.fillText(tr.label, lx, 28);
        lx += Math.max(ctx.measureText(txt).width, ctx.measureText(tr.label).width) + 18;
      });
    }
  }

  /* ------------------------------------------------------------------ */
  class PhasorView {
    constructor(canvas) { this.c = canvas; this.rotate = false; }

    draw(ph, wt) {
      const r = this.c.getBoundingClientRect();
      const { ctx } = fitCanvas(this.c, r.width, r.height);
      const W = r.width, H = r.height;
      ctx.clearRect(0, 0, W, H);
      const cx = W * 0.14, cy = H * 0.66, Rm = Math.min(W * 0.62, H * 0.54);
      const rot = this.rotate ? wt : 0;

      // ejes
      ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(18, cy); ctx.lineTo(W - 12, cy); ctx.moveTo(cx, 14); ctx.lineTo(cx, H - 14); ctx.stroke();
      ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.arc(cx, cy, Rm, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#5f7389'; ctx.font = '11px "Segoe UI", system-ui, sans-serif';
      ctx.fillText('Re', W - 30, cy - 6); ctx.fillText('Im', cx - 24, 24);

      const Imax = Math.max(ph.Is, ph.IL, ph.IR);
      const arrow = (mag, angDeg, col, label, scale, x0 = cx, y0 = cy, dashed = false) => {
        const a = (angDeg * Math.PI) / 180 + rot;
        const L = (mag / scale) * Rm;
        const x1 = x0 + L * Math.cos(a), y1 = y0 - L * Math.sin(a);
        ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = dashed ? 1.4 : 2.6;
        if (dashed) ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.setLineDash([]);
        if (!dashed) {
          const h = 11, aa = Math.atan2(y0 - y1, x1 - x0);
          ctx.beginPath(); ctx.moveTo(x1, y1);
          ctx.lineTo(x1 - h * Math.cos(aa - 0.4), y1 + h * Math.sin(aa - 0.4));
          ctx.lineTo(x1 - h * Math.cos(aa + 0.4), y1 + h * Math.sin(aa + 0.4));
          ctx.closePath(); ctx.fill();
        }
        if (label) {
          ctx.font = '600 13px "Segoe UI", system-ui, sans-serif';
          const dy = label === 'I_L' ? 16 : label === 'Iₛ' ? -8 : 4;
          const dx = label === 'I_R' ? -30 : 4;
          ctx.fillText(label, x1 + 8 * Math.cos(a) + dx, y1 - 8 * Math.sin(a) + dy);
        }
        return [x1, y1];
      };

      // paralelogramo I_R + I_L = I_s
      const [xl, yl] = arrow(ph.IL, ph.angIL, '#ff5c8a', 'I_L', Imax);
      arrow(ph.IR, ph.angIR, 'rgba(106,183,255,.55)', null, Imax, xl, yl, true);
      arrow(ph.IR, ph.angIR, '#6ab7ff', 'I_R', Imax);
      arrow(ph.Is, ph.angIs, '#ffb547', 'Iₛ', Imax);
      arrow(ph.V, ph.angV, '#39e5c6', 'V', ph.V * 1.0);

      // detalle ampliado del cierre del triángulo de corrientes
      if (!this.rotate) {
        let M = 7; const bw = Math.min(150, W * 0.36), bh = Math.min(118, H * 0.46);
        const bx = W - bw - 10, by = 12;
        const k = Rm / Imax;
        const tipIs = [ph.Is * k, 0];
        const aL = ph.angIL * Math.PI / 180, aR = ph.angIR * Math.PI / 180;
        const tipIL = [ph.IL * k * Math.cos(aL), ph.IL * k * Math.sin(aL)];
        M = Math.max(2, Math.round((0.62 * bh) / (ph.IR * k)));
        const mid = [(tipIs[0] + tipIL[0]) / 2, (tipIs[1] + tipIL[1]) / 2];
        const cxi = bx + bw * 0.55, cyi = by + bh * 0.5;
        const map = (P) => [cxi + M * (P[0] - mid[0]), cyi - M * (P[1] - mid[1])];
        ctx.save();
        ctx.fillStyle = 'rgba(3,10,18,.78)'; ctx.strokeStyle = 'rgba(140,180,220,.28)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.rect(bx, by, bw, bh); ctx.fill(); ctx.stroke(); ctx.clip();
        const seg = (A, B, col, w) => { const a = map(A), b = map(B); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); };
        seg([0, 0], tipIs, '#ffb547', 2.4);
        seg([0, 0], tipIL, '#ff5c8a', 2.4);
        seg(tipIL, [tipIL[0] + ph.IR * k * Math.cos(aR), tipIL[1] + ph.IR * k * Math.sin(aR)], '#6ab7ff', 2.4);
        ctx.font = '600 11px "Segoe UI", system-ui, sans-serif';
        const pIs = map(tipIs), pIL = map(tipIL);
        ctx.fillStyle = '#ffb547'; ctx.fillText('Iₛ', pIs[0] + 6, pIs[1] - 6);
        ctx.fillStyle = '#ff5c8a'; ctx.fillText('I_L', pIL[0] - 26, pIL[1] + 14);
        ctx.fillStyle = '#6ab7ff'; ctx.fillText('I_R', (pIs[0] + pIL[0]) / 2 + 6, (pIs[1] + pIL[1]) / 2 + 4);
        ctx.restore();
        ctx.fillStyle = '#8fa3b8'; ctx.font = '10.5px "Segoe UI", system-ui, sans-serif';
        ctx.fillText(`Detalle ×${M}: I_L + I_R = Iₛ`, bx + 6, by + bh + 13);
      }

      // arco del ángulo θ
      ctx.strokeStyle = '#e8eef5'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(cx, cy, 34, -rot, -((ph.angV * Math.PI) / 180 + rot), true); ctx.stroke();
      ctx.fillStyle = '#e8eef5'; ctx.font = '600 13px "Segoe UI", system-ui, sans-serif';
      const am = ((ph.angV / 2) * Math.PI) / 180 + rot;
      ctx.fillText(`θ = ${fmt(ph.angV, 2)}°`, cx + 44 * Math.cos(am) + 4, cy - 44 * Math.sin(am));

      ctx.fillStyle = '#5f7389'; ctx.font = '11px "Segoe UI", system-ui, sans-serif';
      ctx.fillText('Escalas: corrientes y tensión normalizadas por separado', 14, H - 10);
    }
  }

  global.Views = { CircuitView, Scope, PhasorView, fmt };
})(window);
