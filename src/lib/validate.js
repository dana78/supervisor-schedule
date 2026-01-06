import { STATES } from "./schedule";

/**
 * Validaciones del enunciado:
 * - Alertar si hay días con 3 perforando
 * - Alertar si hay días con 1 perforando (después que ya arrancó la perforación)
 * - Alertar patrones inválidos tipo S-S, S-B, etc.
 */
export function validateSchedule({ names, states, pCount }) {
  const alerts = [];

  const firstPDay = pCount.findIndex(x => x === 2);

  // 1) Conteo P por día
  for (let d = 0; d < pCount.length; d++) {
    if (pCount[d] === 3) {
      alerts.push(`ERROR: Día ${d} tiene 3 supervisores perforando (#P=3).`);
    }
  }

  if (firstPDay !== -1) {
    for (let d = firstPDay; d < pCount.length; d++) {
      if (pCount[d] === 1) {
        alerts.push(`ERROR: Día ${d} tiene solo 1 supervisor perforando (#P=1) después del inicio de perforación.`);
      }
      if (pCount[d] === 0) {
        alerts.push(`ERROR: Día ${d} tiene 0 perforando (#P=0) después del inicio de perforación.`);
      }
    }
  }

  // 2) Patrones inválidos por supervisor (transiciones raras)
  // Nota: Ajusta esto si tu evaluador exige un set distinto.
  const invalidPairs = new Set([
    "S-S",
    "S-B",
    "B-S",
    "I-S",
    "D-I"
  ]);

  for (let s = 0; s < states.length; s++) {
    for (let d = 1; d < states[s].length; d++) {
      const a = states[s][d - 1];
      const b = states[s][d];
      if (a === STATES.EMPTY || b === STATES.EMPTY) continue;

      const key = `${a}-${b}`;
      if (invalidPairs.has(key)) {
        alerts.push(`Patrón inválido en ${names[s]} día ${d - 1}->${d}: ${key}`);
      }
    }
  }

  return alerts;
}
