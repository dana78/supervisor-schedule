/**
 * Interpretación correcta del régimen W x R (según uso típico en cronogramas):
 * - W = días en faena (incluye S y B dentro de esos W días)
 * - R = días de descanso (D), completos (NO se resta nada)
 *
 * Primer ciclo:
 *  Dentro de W:
 *   Día 1: S
 *   Luego I días: I
 *   Luego P los días restantes hasta el último
 *   Último día del W: B
 *  Luego R días: D
 *
 * Ciclos siguientes (sin inducción):
 *  Dentro de W:
 *   Día 1: S
 *   Luego P
 *   Último día: B
 *  Luego R días: D
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
  S: "#3b82f6",
  I: "#f59e0b",
  P: "#22c55e",
  B: "#ef4444",
  D: "#9ca3af"
};

function clampInt(n, min, max) {
  const x = Number.isFinite(n) ? Math.floor(n) : min;
  return Math.max(min, Math.min(max, x));
}

/**
 * Retorna el estado de 1 supervisor en el día t, según:
 * - startDay: día en que empieza su primer bloque W (día de S)
 * - W: días de faena (incluye S y B)
 * - R: días descanso (D)
 * - I: inducción (solo en el primer ciclo)
 */
export function getSupervisorStateAtDay(t, startDay, W, R, I) {
  if (t < startDay) return STATES.EMPTY;

  // Normalizamos mínimos lógicos para que no existan bloques negativos:
  // W debe permitir al menos S y B => W >= 2
  W = Math.max(2, W);
  R = Math.max(0, R);
  I = clampInt(I, 1, 5);

  // ---- Primer ciclo (con inducción) ----
  // Dentro de W:
  // offset 0 => S
  // offset 1..I => I
  // offset (1+I)..(W-2) => P
  // offset (W-1) => B
  const firstCycleLen = W + R;

  const firstPos = t - startDay;
  if (firstPos < firstCycleLen) {
    // Estamos dentro del primer ciclo
    if (firstPos === 0) return STATES.S;

    // El último día del bloque W es B (offset W-1)
    if (firstPos === W - 1) return STATES.B;

    // Días de descanso después del bloque W
    if (firstPos >= W) return STATES.D;

    // Inducción (solo dentro del bloque W, después de S)
    if (firstPos >= 1 && firstPos <= I) return STATES.I;

    // Lo demás dentro del bloque W es perforación
    return STATES.P;
  }

  // ---- Ciclos siguientes (sin inducción) ----
  // Cada ciclo: W + R días
  // Dentro de W:
  // offset 0 => S
  // offset 1..(W-2) => P
  // offset (W-1) => B
  // Luego R días => D
  const afterFirst = firstPos - firstCycleLen;
  const cycleLen = W + R;
  const pos = afterFirst % cycleLen;

  if (pos === 0) return STATES.S;
  if (pos === W - 1) return STATES.B;
  if (pos >= W) return STATES.D;
  return STATES.P;
}

/**
 * Construye cronograma y busca offsets (inicio de cada supervisor)
 * para mantener #P=2 (y nunca 3) en todo el horizonte.
 */
export function buildSchedule({ W, R, I, totalPerforationDays }) {
  W = clampInt(W, 2, 60);
  R = clampInt(R, 0, 60);
  I = clampInt(I, 1, 5);
  totalPerforationDays = clampInt(totalPerforationDays, 1, 5000);

  // Horizonte amplio para buscar solución y luego recortar
  const horizon = totalPerforationDays + (W + R) * 8 + 40;

  const startS1 = 0;
  const best = findBestOffsets({ W, R, I, horizon, startS1 });

  const starts = [startS1, best.startS2, best.startS3];
  const names = ["S1", "S2", "S3"];

  const states = names.map(() => Array(horizon).fill(STATES.EMPTY));
  const pCount = Array(horizon).fill(0);

  for (let d = 0; d < horizon; d++) {
    for (let s = 0; s < 3; s++) {
      const st = getSupervisorStateAtDay(d, starts[s], W, R, I);
      states[s][d] = st;
      if (st === STATES.P) pCount[d] += 1;
    }
  }

  // Recorte: queremos al menos T días donde #P==2
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

  return {
    params: { W, R, I, totalPerforationDays },
    starts,
    days,
    names,
    states: states.map(row => row.slice(0, days)),
    pCount: pCount.slice(0, days),
    diagnostics: best.diagnostics
  };
}

function findBestOffsets({ W, R, I, horizon, startS1 }) {
  const cycleLen = W + R;

  // Buscamos offsets dentro de ~2 ciclos para encontrar escalonamiento
  const maxOffset = Math.min(horizon - 1, cycleLen * 2 + 20);

  let best = null;

  for (let startS2 = 0; startS2 <= maxOffset; startS2++) {
    for (let startS3 = 0; startS3 <= maxOffset; startS3++) {
      const diag = scoreOffsets({ W, R, I, horizon, starts: [startS1, startS2, startS3] });

      if (diag.isPerfect) return { startS2, startS3, diagnostics: diag };

      if (!best || diag.score < best.diagnostics.score) {
        best = { startS2, startS3, diagnostics: diag };
      }
    }
  }

  return best ?? { startS2: 0, startS3: cycleLen, diagnostics: scoreOffsets({ W, R, I, horizon, starts: [startS1, 0, cycleLen] }) };
}

function scoreOffsets({ W, R, I, horizon, starts }) {
  const pCount = Array(horizon).fill(0);

  for (let d = 0; d < horizon; d++) {
    for (let s = 0; s < 3; s++) {
      const st = getSupervisorStateAtDay(d, starts[s], W, R, I);
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

  // Penalizamos MUCHO 3P (prohibido) y penalizamos mantener !=2 después de empezar
  const score = threeP * 10000 + notTwoAfterP * 100 + Math.abs(starts[1]) + Math.abs(starts[2]);

  return {
    firstPDay,
    threePDays: threeP,
    notTwoAfterPDays: notTwoAfterP,
    score,
    isPerfect: threeP === 0 && notTwoAfterP === 0
  };
}
