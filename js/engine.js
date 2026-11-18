/* =====================================================================
 * engine.js
 * Motor de simulación transitoria para una red RL en paralelo excitada
 * por una fuente de corriente sinusoidal  i_s(t) = Im·sen(ωt + φ).
 *
 * Ecuaciones del modelo (KCL en el nodo superior):
 *      i_s(t) = i_R(t) + i_L(t)
 *      i_R(t) = v(t) / R
 *      v(t)   = L · di_L/dt
 *
 * Integración numérica: regla trapezoidal (modelo "compañero" del
 * inductor), el mismo esquema que usan Falstad/CircuitJS y SPICE:
 *      i_L[n+1] = i_L[n] + (Δt / 2L)·( v[n] + v[n+1] )
 * Sustituyendo v[n+1] = R·( i_s[n+1] − i_L[n+1] ) se despeja i_L[n+1].
 * Proyecto Final Aplicativo – Análisis de Circuitos Eléctricos – Grupo 4
 * ===================================================================== */
(function (global) {
  'use strict';

  const TAU = 2 * Math.PI;
  const DEG = 180 / Math.PI;

  /** Valor de L que hace |V| = Vrms para una fuente de corriente Irms. */
  function designInductance(Irms, f, R, Vrms) {
    const Y = Irms / Vrms;          // |Y| requerido (S)
    const G = 1 / R;                // conductancia (S)
    if (Y <= G) return NaN;         // no existe solución física
    const BL = Math.sqrt(Y * Y - G * G); // susceptancia inductiva (S)
    return 1 / (TAU * f * BL);      // L = 1/(ω·B_L)
  }

  /** Solución fasorial en régimen estable (valores eficaces). */
  function phasorSolution(p) {
    const w = TAU * p.f;
    const G = 1 / p.R;
    const XL = w * p.L;
    const BL = 1 / XL;
    const Ymag = Math.hypot(G, BL);
    const V = p.Irms / Ymag;
    const theta = Math.atan2(BL, G) * DEG; // V adelanta a I_s
    return {
      w, G, XL, BL, Ymag, Zmag: 1 / Ymag, theta,
      V, Vpk: V * Math.SQRT2,
      Is: p.Irms, Ispk: p.Irms * Math.SQRT2,
      IR: V * G, IL: V * BL,
      angV: theta, angIR: theta, angIL: theta - 90, angIs: 0,
      tau: p.L / p.R,
      P: V * V * G, Q: V * V * BL, S: V * p.Irms,
      fp: Math.cos(theta / DEG)
    };
  }

  /* Acumulador de un periodo: RMS, pico y componentes de Fourier a ω. */
  function newAcc(t0) {
    const z = () => ({ s2: 0, a: 0, b: 0, pk: 0 });
    return { t0, n: 0, v: z(), is: z(), iR: z(), iL: z(), zcV: null, zcI: null };
  }

  class Engine {
    constructor(params) {
      this.p = Object.assign({ Irms: 2.3, f: 60, R: 330, L: 0.05779, phase: 0 }, params);
      this.dt = 5e-6;                 // paso de integración (5 µs)
      this.RING = 40000;              // 200 ms de historia
      this.ring = {
        t: new Float64Array(this.RING), v: new Float32Array(this.RING),
        is: new Float32Array(this.RING), iR: new Float32Array(this.RING),
        iL: new Float32Array(this.RING)
      };
      this.reset();
    }

    reset() {
      this.t = 0; this.iL = 0; this.is = this.source(0);
      this.v = this.p.R * (this.is - this.iL); this.iR = this.v / this.p.R;
      this.head = 0; this.count = 0;
      this.period = 0; this.acc = newAcc(0);
      this.meas = null; this.measHistory = [];
      this.prev = { v: this.v, is: this.is, t: 0 };
      this.push();
    }

    set(params) { Object.assign(this.p, params); }

    source(t) {
      const Im = this.p.Irms * Math.SQRT2;
      return Im * Math.sin(TAU * this.p.f * t + this.p.phase / DEG);
    }

    push() {
      const r = this.ring, h = this.head;
      r.t[h] = this.t; r.v[h] = this.v; r.is[h] = this.is; r.iR[h] = this.iR; r.iL[h] = this.iL;
      this.head = (h + 1) % this.RING;
      if (this.count < this.RING) this.count++;
    }

    /** Un paso de integración trapezoidal. */
    step() {
      const p = this.p, dt = this.dt;
      const t1 = this.t + dt;
      const is1 = this.source(t1);
      const k = dt / (2 * p.L);
      const iL1 = (this.iL + k * (this.v + p.R * is1)) / (1 + k * p.R);
      const v1 = p.R * (is1 - iL1);

      this.prev.v = this.v; this.prev.is = this.is; this.prev.t = this.t;
      this.t = t1; this.is = is1; this.iL = iL1; this.v = v1; this.iR = v1 / p.R;
      this.push();
      this.accumulate();
    }

    advance(n) { for (let i = 0; i < n; i++) this.step(); }

    /* Mediciones por periodo completo (lo que haría un multímetro TRMS
       y un analizador de fase sincronizado con la fuente). */
    accumulate() {
      const T = 1 / this.p.f, w = TAU * this.p.f, a = this.acc;
      const ph = w * this.t;
      const sn = Math.sin(ph), cs = Math.cos(ph);
      const add = (o, x) => { o.s2 += x * x; o.a += x * sn; o.b += x * cs; if (Math.abs(x) > o.pk) o.pk = Math.abs(x); };
      add(a.v, this.v); add(a.is, this.is); add(a.iR, this.iR); add(a.iL, this.iL);
      a.n++;
      // cruces por cero ascendentes (interpolación lineal)
      if (this.prev.v < 0 && this.v >= 0 && a.zcV === null)
        a.zcV = this.prev.t + this.dt * (-this.prev.v) / (this.v - this.prev.v);
      if (this.prev.is < 0 && this.is >= 0 && a.zcI === null)
        a.zcI = this.prev.t + this.dt * (-this.prev.is) / (this.is - this.prev.is);

      if (this.t >= (this.period + 1) * T) {
        const fin = (o) => {
          const A = 2 * o.a / a.n, B = 2 * o.b / a.n;
          return { rms: Math.sqrt(o.s2 / a.n), pk: o.pk, amp: Math.hypot(A, B), ang: Math.atan2(B, A) * DEG };
        };
        const m = {
          period: this.period, t0: a.t0, t1: this.t, samples: a.n,
          v: fin(a.v), is: fin(a.is), iR: fin(a.iR), iL: fin(a.iL)
        };
        m.phaseDFT = wrap(m.v.ang - m.is.ang);
        if (a.zcV !== null && a.zcI !== null) {
          let dtz = a.zcI - a.zcV;                  // >0 si v cruza antes (adelanta)
          dtz = ((dtz % T) + T) % T; if (dtz > T / 2) dtz -= T;
          m.dtZero = dtz; m.phaseZC = dtz * this.p.f * 360;
        }
        this.meas = m;
        this.measHistory.push(m);
        if (this.measHistory.length > 120) this.measHistory.shift();
        this.period++;
        this.acc = newAcc(this.t);
      }
    }

    /** Devuelve las últimas n muestras en orden cronológico (con paso stride). */
    window(n, stride) {
      stride = stride || 1;
      n = Math.min(n, this.count);
      const out = { t: [], v: [], is: [], iR: [], iL: [] };
      const start = (this.head - n + this.RING) % this.RING;
      for (let k = 0; k < n; k += stride) {
        const j = (start + k) % this.RING;
        out.t.push(this.ring.t[j]); out.v.push(this.ring.v[j]); out.is.push(this.ring.is[j]);
        out.iR.push(this.ring.iR[j]); out.iL.push(this.ring.iL[j]);
      }
      return out;
    }
  }

  function wrap(a) { a = ((a + 180) % 360 + 360) % 360 - 180; return a; }

  global.RL = { Engine, designInductance, phasorSolution, TAU, DEG };
})(window);
