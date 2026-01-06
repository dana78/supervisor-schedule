/**
 * Cronograma de 3 supervisores.
 *
 * Interpretación basada en la prueba:
 * - El régimen es W x R (W = días de trabajo / on-site; R = días de descanso total)
 * - La "subida" (S) ocurre el día ANTERIOR al inicio del bloque on-site.
 * - En el primer ciclo: después de S vienen I días de inducción (no perforan) y luego P.
 * - Al terminar el bloque on-site viene "bajada" (B), luego D (descanso real = R - 2), luego S y vuelve a P.
 * - Inducción solo ocurre en el primer ingreso (primer ciclo).
 *
 * Objetivo:
 * - Desde el primer día en que hay perforación, mantener #P == 2 siempre.
 * - Nunca permitir #P == 3.
 */

export const STATES = {
  EMPTY: "-",
  S: "S",
  I: "I",
  P: "P",
  B: "B",
  D: "D"
};

export const COLORS = {
  "-": "#ffffff",
  S: "#3b82f6", // azul
  I: "#f59e0b", // amarillo/naranja
  P: "#22c55e", // verde
  B: "#ef4444", // rojo
  D: "#9ca3af"  // gris
};

function clampInt(n, min, max) {
  const x = Number.isFinite(n) ? Math.floor(n) : min;
  return Math.max(min, Math.min(max, x));
}

/**
 * Genera el estado de UN supervisor para un día t, dado el día de inicio (subida) y parámetros.
 * startDay = día en que ocurre la subida (S) del primer ingreso.
 */
export function getSupervisorStateAtDay(t, startDay, W, R, I) {
  if (t < startDay) return STATES.EMPTY;

  const realRest = Math.max(0, R - 2);

  // Duraciones del primer ciclo:
  // day startDay: S
  // next I days: I
  // next (W - I) days: P (primer ciclo)
  // next 1 day: B
  // next realRest days: D
  // next 1 day: S
  // Luego ciclos repetidos:
  //   W days: P
  //   1 day: B
  //   realRest days: D
  //   1 day: S
  // (sin inducción)

  const firstP = Math.max(0, W - I);

  // Construimos una línea de tiempo por “segmentos” para mapear t.
  let cursor = startDay;

  // 1) S
  if (t === cursor) return STATES.S;
  cursor += 1;

  // 2) I (solo primer ciclo)
  if (t >= cursor && t < cursor + I) return STATES.I;
  cursor += I;

  // 3) P del primer ciclo
  if (t >= cursor && t < cursor + firstP) return STATES.P;
  cursor += firstP;

  // 4) B
  if (t === cursor) return STATES.B;
  cursor += 1;

  // 5) D (descanso real)
  if (t >= cursor && t < cursor + realRest) return STATES.D;
  cursor += realRest;

  // 6) S (retorno)
  if (t === cursor) return STATES.S;
  cursor += 1;

  // A partir de aquí: ciclos repetidos (P W días, B 1 día, D realRest, S 1 día)
  const cycleLen = W + 1 + realRest + 1;

  if (cycleLen === 0) return STATES.EMPTY;

  const k = t - cursor;
  const pos = ((k % cycleLen) + cycleLen) % cycleLen;

  if (pos < W) return STATES.P;
  if (pos === W) return STATES.B;
  if (pos > W && pos < W + 1 + realRest) return STATES.D;
  return STATES.S;
}

/**
 * Genera cronograma completo y valida cobertura.
 */
export function buildSchedule({ W, R, I, totalPerforationDays }) {
  // Normalizaciones seguras según rangos típicos del reto
  W = clampInt(W, 1, 60);
  R = clampInt(R, 2, 60);
  I = clampInt(I, 1, 5);
  totalPerforationDays = clampInt(totalPerforationDays, 1, 5000);

  // Horizonte: necesitamos al menos totalPerforationDays de operación.
  // Como deben perforar 2 por día, tomamos un margen extra para transiciones.
  const horizon = totalPerforationDays + (W + R + I) * 6 + 20;

  // S1 fijo al día 0
  const startS1 = 0;

  // Buscamos offsets (start days) para S2 y S3 que cumplan:
  // - desde el primer día que hay P, #P == 2 siempre
  // - nunca #P == 3
  const best = findBestOffsets({ W, R, I, horizon, startS1 });

  const starts = [startS1, best.startS2, best.startS3];
  const names = ["S1", "S2", "S3"];

  // Matriz estados[supervisor][day]
  const states = names.map(() => Array(horizon).fill(STATES.EMPTY));
  const pCount = Array(horizon).fill(0);

  for (let d = 0; d < horizon; d++) {
    for (let s = 0; s < 3; s++) {
      const st = getSupervisorStateAtDay(d, starts[s], W, R, I);
      states[s][d] = st;
      if (st === STATES.P) pCount[d] += 1;
    }
  }

  // Recortamos al mínimo necesario: hasta que se cumplan totalPerforationDays con #P==2
  // (para que la grilla no sea enorme)
  let daysWithTwo = 0;
  let endDay = horizon - 1;
  for (let d = 0; d < horizon; d++) {
    if (pCount[d] === 2) daysWithTwo += 1;
    if (daysWithTwo >= totalPerforationDays) {
      endDay = d;
      break;
    }
  }

  const days = endDay + 1;
  const trimmedStates = states.map(row => row.slice(0, days));
  const trimmedPCount = pCount.slice(0, days);

  return {
    params: { W, R, I, totalPerforationDays },
    starts,
    days,
    names,
    states: trimmedStates,
    pCount: trimmedPCount,
    diagnostics: best.diagnostics
  };
}

/**
 * Búsqueda discreta de offsets:
 * - Probamos varios startDay para S2 y S3 dentro de un rango acotado.
 * - Elegimos el primero que satisface perfecto; si no, el “mejor” (menos errores).
 */
function findBestOffsets({ W, R, I, horizon, startS1 }) {
  const maxOffset = Math.min(horizon - 1, (W + R + I) * 3 + 20);

  // Rango razonable: S2 típicamente entra cerca del inicio; S3 entra “antes” de la bajada de S1
  // Igual, lo dejamos amplio para que el solver encuentre combinaciones.
  const candidatesS2 = [];
  const candidatesS3 = [];

  for (let d = 0; d <= maxOffset; d++) {
    candidatesS2.push(d);
    candidatesS3.push(d);
  }

  let best = null;

  for (const startS2 of candidatesS2) {
    for (const startS3 of candidatesS3) {
      const diag = scoreOffsets({ W, R, I, horizon, starts: [startS1, startS2, startS3] });

      // Primero buscamos solución perfecta
      if (diag.isPerfect) {
        return { startS2, startS3, diagnostics: diag };
      }

      // Si no hay perfecta, guardamos la mejor por score
      if (!best || diag.score < best.diagnostics.score) {
        best = { startS2, startS3, diagnostics: diag };
      }
    }
  }

  // Si no existe perfecta (caso extremo), devolvemos la mejor encontrada
  return best ?? { startS2: 0, startS3: (W + 1), diagnostics: scoreOffsets({ W, R, I, horizon, starts: [startS1, 0, W + 1] }) };
}

/**
 * Calcula métricas de cumplimiento:
 * - Nunca 3 perforando
 * - Desde primer día con perforación, siempre 2 perforando
 */
function scoreOffsets({ W, R, I, horizon, starts }) {
  const pCount = Array(horizon).fill(0);
  const states = [[], [], []];

  for (let d = 0; d < horizon; d++) {
    for (let s = 0; s < 3; s++) {
      const st = getSupervisorStateAtDay(d, starts[s], W, R, I);
      states[s][d] = st;
      if (st === STATES.P) pCount[d] += 1;
    }
  }

  const firstPDay = pCount.findIndex(x => x > 0);
  let threeP = 0;
  let notTwoAfterP = 0;

  for (let d = 0; d < horizon; d++) {
    if (pCount[d] === 3) threeP += 1;
    if (firstPDay !== -1 && d >= firstPDay && pCount[d] !== 2) notTwoAfterP += 1;
  }

  // Penalizamos MUCHO tener 3 perforando (error crítico del enunciado).
  const score = threeP * 1000 + notTwoAfterP * 10 + Math.abs(starts[1] - starts[0]) + Math.abs(starts[2] - starts[0]);

  return {
    firstPDay,
    threePDays: threeP,
    notTwoAfterPDays: notTwoAfterP,
    score,
    isPerfect: threeP === 0 && notTwoAfterP === 0
  };
}
