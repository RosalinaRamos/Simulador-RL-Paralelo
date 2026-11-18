# Laboratorio virtual: red RL en paralelo con fuente de corriente sinusoidal

Proyecto Final Aplicativo (Informe Técnico N.° 2) – Análisis de Circuitos Eléctricos
Ingeniería Mecánica Eléctrica – Universidad César Vallejo, 2026-II
Grupo 4: BRITO CABELLO, HILARIO ROLANDO (hbritoc@ucvvirtual.edu.pe)
Docente: Ing. José Luis Encarnación

## Datos del circuito asignado
| Magnitud | Valor |
|---|---|
| Fuente de corriente | 2,3 A eficaces (Iₘ = 3,2527 A), 60 Hz |
| Resistencia | 330 Ω |
| Condición de diseño | \|V\| = 50 V eficaces |
| Inductancia calculada | L = 57,79 mH |

## Cómo ejecutarlo en Visual Studio Code
1. Abrir la carpeta `rl-paralelo-sim` con *Archivo → Abrir carpeta…*
2. Instalar la extensión recomendada **Live Server** (VS Code la sugiere al abrir la carpeta).
3. Clic derecho sobre `index.html` → **Open with Live Server**.
   También funciona con doble clic sobre `index.html` (no requiere servidor ni internet).

## Estructura
```
rl-paralelo-sim/
├── index.html          interfaz (esquema, osciloscopios, fasores, tablas)
├── css/styles.css      estilos
├── js/engine.js        motor de simulación transitoria (regla trapezoidal, Δt = 5 µs)
├── js/views.js         esquema animado estilo Falstad, osciloscopios y diagrama fasorial
├── js/background.js    fondo animado de partículas sobre líneas de flujo
├── js/app.js           controlador: controles, diseño de L, mediciones y tabla comparativa
└── .vscode/            configuración del espacio de trabajo
```

## Modelo matemático
KCL en el nodo superior: iₛ(t) = v(t)/R + i_L(t), con v(t) = L·di_L/dt.
El inductor se discretiza con la regla trapezoidal (modelo compañero), el mismo
método que emplean Falstad/CircuitJS y SPICE:

    i_L[n+1] = ( i_L[n] + (Δt/2L)·( v[n] + R·iₛ[n+1] ) ) / ( 1 + R·Δt/2L )
    v[n+1]   = R·( iₛ[n+1] − i_L[n+1] )

Al final de cada ciclo de la fuente se calculan los valores eficaces (TRMS), los valores
pico y la fase de cada señal mediante la componente fundamental de Fourier (DFT); el
desfase también se obtiene por cruces por cero.

## Uso
- **Ejecutar/Detener** y **Reiniciar** controlan la simulación; tras reiniciar se observa el
  transitorio inicial (τ = L/R ≈ 175 µs).
- Clic sobre la fuente, el inductor o la resistencia abre su cuadro de edición
  (la fuente se edita en valor máximo, como en Falstad).
- El panel *Cálculo de L* resuelve el diseño para cualquier tensión requerida y lo aplica.
- Desde la consola del navegador: `LAB.run(0.2)` avanza 200 ms y `SIM.meas` muestra
  la última medición.
