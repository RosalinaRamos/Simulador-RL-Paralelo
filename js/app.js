/* =====================================================================
 * app.js  –  Controlador de la interfaz del laboratorio virtual
 * ===================================================================== */
(function () {
  'use strict';
  const { Engine, designInductance, phasorSolution } = window.RL;
  const { CircuitView, Scope, PhasorView, fmt } = window.Views;
  const $ = (s) => document.querySelector(s);

  /* ---- Datos del Grupo 4 -------------------------------------------- */
  const SPEC = { Irms: 2.3, f: 60, R: 330, Vtarget: 50 };
  const Ldesign = designInductance(SPEC.Irms, SPEC.f, SPEC.R, SPEC.Vtarget);
  const Lused = Math.round(Ldesign * 1e5) / 1e5;           // 57,79 mH (valor ingresado)

  const eng = new Engine({ Irms: SPEC.Irms, f: SPEC.f, R: SPEC.R, L: Lused });
  window.SIM = eng;                                          // acceso desde consola
  window.SIM_SPEC = SPEC; window.SIM_LDESIGN = Ldesign;

  const state = { running: true, speed: 24, dotSpeed: 3.2, frame: 0, periods: 2 };

  /* ---- Vistas -------------------------------------------------------- */
  const bg = new FluxBackground($('#bg'), () => {
    const th = phasorSolution(eng.p); return eng.iL / (th.IL * Math.SQRT2 || 1);
  });
  const circuit = new CircuitView($('#circuit'), openEditor);
  const scopes = [
    new Scope($('#scope-v'), [
      { key: 'v', color: '#39e5c6', label: 'fuente, tensión v(t)', unit: 'V', dec: 2 },
      { key: 'is', color: '#ffb547', label: 'fuente, corriente iₛ(t)', unit: 'A', dec: 3 }
    ]),
    new Scope($('#scope-ir'), [{ key: 'iR', color: '#6ab7ff', label: `resistencia, ${SPEC.R} Ω`, unit: 'A', dec: 4 }]),
    new Scope($('#scope-il'), [{ key: 'iL', color: '#ff5c8a', label: 'inductor, i_L(t)', unit: 'A', dec: 3 }])
  ];
  const phasor = new PhasorView($('#phasor'));

  /* ---- Controles ----------------------------------------------------- */
  const sliders = {
    speed: $('#sl-speed'), dots: $('#sl-dots'), I: $('#sl-I'), f: $('#sl-f'), R: $('#sl-R'), L: $('#sl-L')
  };
  function syncSliders() {
    sliders.I.value = eng.p.Irms; sliders.f.value = eng.p.f; sliders.R.value = eng.p.R; sliders.L.value = eng.p.L * 1000;
    $('#val-I').textContent = `${fmt(eng.p.Irms, 2)} A`;
    $('#val-f').textContent = `${fmt(eng.p.f, 0)} Hz`;
    $('#val-R').textContent = `${fmt(eng.p.R, 0)} Ω`;
    $('#val-L').textContent = `${fmt(eng.p.L * 1000, 2)} mH`;
  }
  sliders.speed.addEventListener('input', () => { state.speed = +sliders.speed.value; });
  sliders.dots.addEventListener('input', () => { state.dotSpeed = +sliders.dots.value; });
  sliders.I.addEventListener('input', () => { eng.set({ Irms: +sliders.I.value }); syncSliders(); refreshDesign(); });
  sliders.f.addEventListener('input', () => { eng.set({ f: +sliders.f.value }); syncSliders(); refreshDesign(); });
  sliders.R.addEventListener('input', () => { eng.set({ R: +sliders.R.value }); syncSliders(); refreshDesign(); });
  sliders.L.addEventListener('input', () => { eng.set({ L: +sliders.L.value / 1000 }); syncSliders(); });

  $('#btn-run').addEventListener('click', () => {
    state.running = !state.running;
    $('#btn-run').textContent = state.running ? 'Detener' : 'Ejecutar';
    $('#btn-run').classList.toggle('is-paused', !state.running);
  });
  $('#btn-reset').addEventListener('click', () => { eng.reset(); });
  $('#btn-design').addEventListener('click', applyDesign);
  $('#btn-g4').addEventListener('click', () => {
    eng.set({ Irms: SPEC.Irms, f: SPEC.f, R: SPEC.R, L: Lused }); $('#in-V').value = SPEC.Vtarget;
    syncSliders(); refreshDesign(); eng.reset();
  });
  $('#in-V').addEventListener('input', refreshDesign);
  $('#chk-rot').addEventListener('change', (e) => { phasor.rotate = e.target.checked; });
  document.querySelectorAll('[data-periods]').forEach((b) => b.addEventListener('click', () => {
    state.periods = +b.dataset.periods;
    document.querySelectorAll('[data-periods]').forEach((x) => x.setAttribute('aria-pressed', x === b));
  }));

  /* ---- Panel de diseño ---------------------------------------------- */
  function refreshDesign() {
    const Vt = +$('#in-V').value || SPEC.Vtarget;
    const p = eng.p, w = 2 * Math.PI * p.f, Y = p.Irms / Vt, G = 1 / p.R;
    const ok = Y > G;
    const BL = ok ? Math.sqrt(Y * Y - G * G) : NaN, XL = 1 / BL, L = XL / w;
    $('#d-w').textContent = fmt(w, 2);
    $('#d-Y').textContent = fmt(Y * 1000, 3);
    $('#d-G').textContent = fmt(G * 1000, 4);
    $('#d-B').textContent = fmt(BL * 1000, 3);
    $('#d-X').textContent = fmt(XL, 3);
    $('#d-L').textContent = fmt(L * 1000, 2);
    $('#d-warn').hidden = ok;
    $('#btn-design').disabled = !ok;
    $('#btn-design').dataset.L = L;
  }
  function applyDesign() {
    const L = +$('#btn-design').dataset.L; if (!isFinite(L)) return;
    eng.set({ L: Math.round(L * 1e5) / 1e5 }); syncSliders(); eng.reset();
  }

  /* ---- Editor de componentes (similar al diálogo "Editar" de Falstad) */
  const dlg = $('#editor');
  function openEditor(id) {
    const f = $('#editor-fields'); f.innerHTML = '';
    const row = (label, key, val, step) => {
      f.insertAdjacentHTML('beforeend',
        `<label class="field"><span>${label}</span><input type="number" step="${step}" data-key="${key}" value="${val}"></label>`);
    };
    if (id === 'source') {
      $('#editor-title').textContent = 'Fuente de corriente sinusoidal';
      row('Corriente máxima, Iₘ (A)', 'Ipk', (eng.p.Irms * Math.SQRT2).toFixed(4), '0.0001');
      row('Frecuencia (Hz)', 'f', eng.p.f, '1');
      row('Desfase inicial (°)', 'phase', eng.p.phase, '1');
      $('#editor-note').textContent = `Valor eficaz equivalente: ${fmt(eng.p.Irms, 4)} A (Iₘ / √2).`;
    } else if (id === 'inductor') {
      $('#editor-title').textContent = 'Inductor';
      row('Inductancia (H)', 'L', eng.p.L.toFixed(5), '0.00001');
      $('#editor-note').textContent = `X_L = ωL = ${fmt(2 * Math.PI * eng.p.f * eng.p.L, 3)} Ω a ${fmt(eng.p.f, 0)} Hz.`;
    } else {
      $('#editor-title').textContent = 'Resistencia';
      row('Resistencia (Ω)', 'R', eng.p.R, '1');
      $('#editor-note').textContent = `G = 1/R = ${fmt(1000 / eng.p.R, 4)} mS.`;
    }
    dlg.showModal();
  }
  $('#editor-ok').addEventListener('click', (e) => {
    e.preventDefault();
    dlg.querySelectorAll('input[data-key]').forEach((i) => {
      const v = +i.value; if (!isFinite(v) || v <= 0 && i.dataset.key !== 'phase') return;
      if (i.dataset.key === 'Ipk') eng.set({ Irms: v / Math.SQRT2 }); else eng.set({ [i.dataset.key]: v });
    });
    syncSliders(); refreshDesign(); dlg.close();
  });
  $('#editor-cancel').addEventListener('click', (e) => { e.preventDefault(); dlg.close(); });

  /* ---- Tabla de resultados ----------------------------------------- */
  function err(t, s) { return Math.abs((t - s) / t) * 100; }
  function refreshResults() {
    const th = phasorSolution(eng.p), m = eng.meas;
    $('#t-tau').textContent = `${fmt(th.tau * 1e6, 1)} µs`;
    $('#r-time').textContent = `t = ${fmt(eng.t * 1000, 2)} ms`;
    $('#r-dt').textContent = `intervalo de tiempo = ${fmt(eng.dt * 1e6, 0)} µs`;
    $('#r-f').textContent = `f = ${fmt(eng.p.f, 0)} Hz  ·  ciclo ${eng.period + 1}`;
    const steady = m && m.t0 > 10 * th.tau;
    $('#r-status').textContent = !m ? 'Esperando el primer ciclo completo…' :
      steady ? `Régimen estable · ciclo medido n.º ${m.period + 1} (${m.samples} muestras)` : 'Régimen transitorio en curso';
    $('#r-status').dataset.ok = !!steady;
    const rows = [
      ['Corriente de fuente (ef)', th.Is, m && m.is.rms, 'A', 4],
      ['Tensión de fuente (ef)', th.V, m && m.v.rms, 'V', 3],
      ['Corriente en R (ef)', th.IR, m && m.iR.rms, 'A', 5],
      ['Corriente en L (ef)', th.IL, m && m.iL.rms, 'A', 4],
      ['Ángulo de desfase θ', th.theta, m && m.phaseDFT, '°', 3],
      ['Tensión pico', th.Vpk, m && m.v.pk, 'V', 3]
    ];
    $('#results tbody').innerHTML = rows.map(([n, t, s, u, d]) =>
      `<tr><th scope="row">${n}</th><td>${fmt(t, d)} ${u}</td><td>${s == null ? '—' : fmt(s, d) + ' ' + u}</td>` +
      `<td>${s == null ? '—' : fmt(err(t, s), 3) + ' %'}</td></tr>`).join('');
    $('#m-dtz').textContent = m && m.dtZero != null ? `${fmt(m.dtZero * 1000, 4)} ms → ${fmt(m.phaseZC, 2)}°` : '—';
    $('#m-pf').textContent = `${fmt(th.fp, 4)} (inductivo)`;
    $('#m-pq').textContent = `P = ${fmt(th.P, 2)} W · Q = ${fmt(th.Q, 2)} var`;
    $('#ph-v').textContent = `${fmt(th.V, 3)} ∠ ${fmt(th.angV, 2)}° V`;
    $('#ph-is').textContent = `${fmt(th.Is, 3)} ∠ 0,00° A`;
    $('#ph-ir').textContent = `${fmt(th.IR, 4)} ∠ ${fmt(th.angIR, 2)}° A`;
    $('#ph-il').textContent = `${fmt(th.IL, 4)} ∠ ${fmt(th.angIL, 2)}° A`;
  }

  /* ---- Bucle principal --------------------------------------------- */
  let last = performance.now();
  function loop(now) {
    const dtSec = Math.min(0.05, (now - last) / 1000); last = now;
    if (state.running) eng.advance(state.speed);
    const th = phasorSolution(eng.p);
    bg.frame(dtSec);
    circuit.draw(eng, th, state.running ? state.dotSpeed : 0, dtSec);
    scopes.forEach((s) => s.draw(eng, state.periods));
    phasor.draw(th, 2 * Math.PI * eng.p.f * eng.t);
    if (state.frame++ % 6 === 0) refreshResults();
    requestAnimationFrame(loop);
  }

  /* API para pruebas/automatización (capturas para el informe) */
  window.LAB = {
    pause() { state.running = false; $('#btn-run').textContent = 'Ejecutar'; $('#btn-run').classList.add('is-paused'); },
    play() { state.running = true; $('#btn-run').textContent = 'Detener'; $('#btn-run').classList.remove('is-paused'); },
    run(seconds) { eng.advance(Math.round(seconds / eng.dt)); refreshResults(); },
    refresh: refreshResults, openEditor, phasor, state
  };

  syncSliders(); refreshDesign(); refreshResults();
  requestAnimationFrame(loop);
})();
