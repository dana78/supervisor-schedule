import React, { useMemo, useState } from "react";
import { buildSchedule, COLORS } from "./lib/schedule";
import { validateSchedule } from "./lib/validate";

export default function App() {
  const [W, setW] = useState(14);
  const [R, setR] = useState(7);
  const [I, setI] = useState(5);
  const [T, setT] = useState(90);

  const [result, setResult] = useState(null);
  const [alerts, setAlerts] = useState([]);

  const legend = useMemo(() => ([
    { k: "S", label: "Subida" },
    { k: "I", label: "Inducción" },
    { k: "P", label: "Perforación" },
    { k: "B", label: "Bajada" },
    { k: "D", label: "Descanso" },
    { k: "-", label: "Vacío" }
  ]), []);

  function onCalc() {
    const schedule = buildSchedule({ W: Number(W), R: Number(R), I: Number(I), totalPerforationDays: Number(T) });
    const a = validateSchedule(schedule);
    setResult(schedule);
    setAlerts(a);
  }

  function onReset() {
    setResult(null);
    setAlerts([]);
  }

  return (
    <div className="container">
      <div className="card">
        <h1>Cronograma de Supervisores (3) – objetivo: 2 perforando por día</h1>
        <p className="muted">
          Ingresa el régimen <b>W x R</b>, días de inducción y días totales requeridos de perforación.
        </p>

        <div className="row">
          <div className="field" style={{ gridColumn: "span 3" }}>
            <label>Días de trabajo (W)</label>
            <input type="number" min="1" max="60" value={W} onChange={(e) => setW(e.target.value)} />
          </div>

          <div className="field" style={{ gridColumn: "span 3" }}>
            <label>Días de descanso total (R)</label>
            <input type="number" min="2" max="60" value={R} onChange={(e) => setR(e.target.value)} />
          </div>

          <div className="field" style={{ gridColumn: "span 3" }}>
            <label>Días de inducción (1 a 5)</label>
            <input type="number" min="1" max="5" value={I} onChange={(e) => setI(e.target.value)} />
          </div>

          <div className="field" style={{ gridColumn: "span 3" }}>
            <label>Total días a perforar (T)</label>
            <input type="number" min="1" max="5000" value={T} onChange={(e) => setT(e.target.value)} />
          </div>
        </div>

        <div className="actions">
          <button onClick={onCalc}>Calcular Cronograma</button>
          <button className="secondary" onClick={onReset}>Limpiar</button>
        </div>

        <div className="legend">
          {legend.map(x => (
            <span className="pill" key={x.k}>
              <span className="dot" style={{ background: COLORS[x.k] }} />
              {x.k}: {x.label}
            </span>
          ))}
        </div>

        <div className="small" style={{ marginTop: 10 }}>
          <b>Diagnóstico del solver:</b>{" "}
          {result ? (
            <>
              offsets (día subida): S1={result.starts[0]}, S2={result.starts[1]}, S3={result.starts[2]} ·
              firstPDay={result.diagnostics.firstPDay} ·
              3PDays={result.diagnostics.threePDays} ·
              notTwoAfterPDays={result.diagnostics.notTwoAfterPDays}
            </>
          ) : (
            "—"
          )}
        </div>
      </div>

      {result && (
        <div className="card">
          {alerts.length === 0 ? (
            <div className="ok">✅ Sin errores: no hay 3 perforando y se mantiene #P=2 desde el inicio de perforación.</div>
          ) : (
            <>
              <div style={{ fontWeight: 700, color: "#b42318", marginBottom: 8 }}>
                ⚠️ Alertas / Errores detectados
              </div>
              <ul className="alerts">
                {alerts.slice(0, 12).map((a, i) => <li key={i}>{a}</li>)}
              </ul>
              {alerts.length > 12 && <div className="small">Mostrando 12 de {alerts.length} alertas.</div>}
            </>
          )}

          <div className="gridWrap" style={{ marginTop: 14 }}>
            <table className="grid">
              <thead>
                <tr>
                  <th className="sticky">Día</th>
                  {Array.from({ length: result.days }).map((_, d) => (
                    <th key={d}>{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.names.map((name, sIdx) => (
                  <tr key={name}>
                    <td className="sticky" style={{ fontWeight: 700 }}>{name}</td>
                    {result.states[sIdx].map((st, d) => (
                      <td
                        key={d}
                        title={`${name} día ${d}: ${st}`}
                        style={{
                          background: COLORS[st],
                          color: st === "-" ? "#777" : "#111",
                          fontWeight: st === "P" ? 700 : 500
                        }}
                      >
                        {st}
                      </td>
                    ))}
                  </tr>
                ))}

                <tr>
                  <td className="sticky" style={{ fontWeight: 800 }}>#P</td>
                  {result.pCount.map((x, d) => (
                    <td key={d} className={x !== 2 && d >= result.diagnostics.firstPDay ? "bad" : ""}>
                      {x}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <div className="small" style={{ marginTop: 10 }}>
            Nota: Los días con <b>#P != 2</b> (después de empezar la perforación) se resaltan en rojo.
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Casos de prueba obligatorios (según la prueba)</div>
        <div className="small">
          Prueba estos inputs y verifica que la app responde y no cae en errores de 3P / 1P:
          <ul>
            <li>14x7, inducción 5, perforación 90</li>
            <li>21x7, inducción 3, perforación 90</li>
            <li>10x5, inducción 2, perforación 90</li>
            <li>14x6, inducción 4, perforación 950</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
