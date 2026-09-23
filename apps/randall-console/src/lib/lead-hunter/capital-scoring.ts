// src/lib/lead-hunter/capital-scoring.ts
// Cerebro de crédito del Motor 2 — scoring fit / need / risk y ruteo a tier de crédito.
// OJO: este tier NO es el tier de venta del analysis-engine. Son dos sistemas distintos.

export type RutaCredito =
  "TIER_S_FINANCIAMIENTO" | "TIER_A_BLINDAJE" | "TIER_B" | "NURTURE" | "DESCARTE";

export type ConfianzaCredito = "alta" | "media" | "baja";

export type ContratistaInput = {
  id?: string;
  nombre: string;
  ciudad?: string | null;
  oficio?: string | null;

  // Legal / L&I
  licencia_vigente?: boolean | null;
  años_operando?: number | null;
  tipo_entidad?: "LLC" | "Corp" | "Sole" | "Partnership" | "Unknown" | null;
  fianza_monto?: number | null; // bond amount USD
  licencia_tipo?: string | null; // GENERAL / SPECIALTY según L&I
  banderas_rojas?: string[];

  // Actividad / obra
  permisos_12m?: number | null;
  valor_obra_12m?: number | null; // USD
  tamaño_estimado?: "solo" | "micro" | "pequeña" | "mediana" | null;

  // DOR
  dor_activo?: boolean | null;
  dor_delincuente?: boolean | null; // embargo fiscal / tax warrant

  // Señales profundas de L&I verify (scrape) — las más fuertes para crédito
  fianza_cancelada?: boolean | null;
  fianza_vence?: string | null; // ISO
  seguro_monto?: number | null;
  deuda_lni?: boolean | null;
  suspensiones?: number | null;
  infracciones?: number | null;

  // Assessor
  direccion_residencial?: boolean | null;

  // Digital
  sitio_web?: boolean | null;
  google_maps?: boolean | null;
  reseñas_count?: number | null;
  rating?: number | null;
  profesionalismo_score?: number | null; // 1-10
};

export type Eje = { score: number; señales: string[] };

export type CapitalScore = {
  id?: string;
  nombre: string;
  fit: Eje;
  need: Eje;
  risk: Eje;
  total: number;
  ruta: RutaCredito;
  confianza: ConfianzaCredito;
  motivo: string;
  scored_at: string;
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

// Washington L&I minimum contractor bonds (effective for registrations/renewals since 2024).
// Keep centralized so a future statutory change does not silently distort the score.
const BOND_MIN_GENERAL = 30_000;
const BOND_MIN_SPECIALTY = 15_000;

function requiredBondMinimum(licenseType?: string | null): number | null {
  const t = String(licenseType ?? "").toUpperCase();
  if (t.includes("GENERAL")) return BOND_MIN_GENERAL;
  if (t.includes("SPECIAL")) return BOND_MIN_SPECIALTY;
  return null;
}

// ── FIT: ¿encaja con el producto de crédito? ────────────────────────────────
function scoreFit(c: ContratistaInput): Eje {
  let s = 30;
  const señales: string[] = [];

  const años = c.años_operando ?? null;
  if (años !== null) {
    if (años >= 3 && años <= 15) {
      s += 20;
      señales.push(`${años} años operando — etapa de crecimiento`);
    } else if (años > 15) {
      s += 10;
      señales.push(`${años} años operando — negocio maduro`);
    } else {
      s -= 5;
      señales.push(`Solo ${años} año(s) operando`);
    }
  }

  if (c.tipo_entidad === "LLC" || c.tipo_entidad === "Corp") {
    s += 12;
    señales.push(`Entidad formal (${c.tipo_entidad}) — sujeto de crédito`);
  } else if (c.tipo_entidad === "Sole") {
    s -= 5;
  }

  if (c.licencia_vigente) {
    s += 12;
    señales.push("Licencia L&I vigente");
  }
  if (c.dor_activo) s += 6;

  switch (c.tamaño_estimado) {
    case "pequeña":
      s += 14;
      señales.push("Tamaño pequeño — ticket de crédito ideal");
      break;
    case "mediana":
      s += 10;
      break;
    case "micro":
      s += 4;
      break;
    case "solo":
      s -= 6;
      break;
    default:
      break;
  }

  if ((c.valor_obra_12m ?? 0) > 250_000) {
    s += 10;
    señales.push(`Obra rastreada ~$${Math.round((c.valor_obra_12m ?? 0) / 1000)}k en 12m`);
  }

  return { score: clamp(s), señales };
}

// ── NEED: ¿le falta capital de trabajo? ─────────────────────────────────────
function scoreNeed(c: ContratistaInput): Eje {
  let s = 35;
  const señales: string[] = [];

  const permisos = c.permisos_12m ?? 0;
  if (permisos >= 5) {
    s += 20;
    señales.push(`${permisos} permisos en 12 meses — flujo de obra que financiar`);
  } else if (permisos >= 2) {
    s += 12;
    señales.push(`${permisos} permisos activos`);
  }

  const fianza = c.fianza_monto ?? null;
  const minBond = requiredBondMinimum(c.licencia_tipo);
  if (fianza !== null) {
    if (minBond !== null && fianza <= minBond) {
      s += 18;
      señales.push(
        `Fianza en el mínimo legal ($${fianza.toLocaleString()}) — poco colchón adicional visible`,
      );
    } else if (minBond === null && fianza <= BOND_MIN_SPECIALTY) {
      // Sin tipo de licencia no afirmamos que sea "la mínima"; solo la tratamos
      // como señal moderada hasta confirmar GENERAL vs SPECIALTY.
      s += 10;
      señales.push(
        `Fianza baja ($${fianza.toLocaleString()}) — confirmar tipo de licencia antes de interpretar`,
      );
    } else if (fianza >= 50_000) {
      s -= 12;
      señales.push(`Fianza alta ($${fianza.toLocaleString()}) — mayor respaldo aparente`);
    }
  }

  if (c.tamaño_estimado === "micro" || c.tamaño_estimado === "pequeña") {
    s += 12;
    señales.push("Empresa chica creciendo — brecha de capital de trabajo típica");
  }

  if (
    (c.valor_obra_12m ?? 0) > 500_000 &&
    fianza !== null &&
    minBond !== null &&
    fianza <= minBond
  ) {
    s += 15;
    señales.push(
      "Volumen de obra alto con fianza en el mínimo legal — posible presión de capital de trabajo",
    );
  }

  if (!c.sitio_web) {
    s += 5;
    señales.push("Sin sitio web — poca inversión en infraestructura");
  }
  if ((c.profesionalismo_score ?? 5) >= 8) s -= 8;

  if (c.direccion_residencial) {
    s += 6;
    señales.push("Opera desde domicilio — sin oficina, micro estructura");
  }
  if (c.fianza_vence) {
    const dias = Math.round((Date.parse(c.fianza_vence) - Date.now()) / 86_400_000);
    if (dias >= 0 && dias <= 90) {
      s += 10;
      señales.push(`Fianza vence en ${dias} días — renovación a la vuelta`);
    }
  }
  if ((c.seguro_monto ?? 0) > 0 && (c.seguro_monto ?? 0) <= 200_000) {
    s += 6;
    señales.push(`Seguro mínimo ($${(c.seguro_monto ?? 0).toLocaleString()})`);
  }

  return { score: clamp(s), señales };
}

// ── RISK: ¿está tronado? (más alto = más riesgo) ────────────────────────────
function scoreRisk(c: ContratistaInput): Eje {
  let s = 30;
  const señales: string[] = [];

  if (c.licencia_vigente === false) {
    s += 35;
    señales.push("Licencia NO vigente");
  }
  if (c.dor_activo === false) {
    s += 15;
    señales.push("Cuenta DOR inactiva");
  }

  const flags = c.banderas_rojas ?? [];
  if (flags.length) {
    s += Math.min(30, flags.length * 10);
    señales.push(...flags.slice(0, 3).map((f) => `Bandera roja: ${f}`));
  }

  const años = c.años_operando ?? null;
  if (años !== null && años < 2) {
    s += 15;
    señales.push("Menos de 2 años de historial");
  } else if (años !== null && años >= 5) {
    s -= 12;
  }

  const minBond = requiredBondMinimum(c.licencia_tipo);
  if (minBond !== null && (c.fianza_monto ?? 0) > minBond) s -= 8;
  if (c.google_maps && (c.reseñas_count ?? 0) >= 10) {
    s -= 8;
    señales.push(`${c.reseñas_count} reseñas en Google (${c.rating ?? "?"}★)`);
  }
  if (c.tipo_entidad === "Sole") s += 8;

  // Señales profundas (L&I verify) — las de mayor peso
  if (c.fianza_cancelada) {
    s += 30;
    señales.push("Fianza CANCELADA — señal roja fuerte");
  }
  if (c.dor_delincuente) {
    s += 25;
    señales.push("Embargo fiscal / tax warrant registrado");
  }
  if (c.deuda_lni) {
    s += 20;
    señales.push("Adeudos o demandas ante L&I");
  }
  const susp = c.suspensiones ?? 0;
  if (susp > 0) {
    s += Math.min(20, susp * 10);
    señales.push(`${susp} suspensión(es) de licencia en historial`);
  }
  const inf = c.infracciones ?? 0;
  if (inf > 0) {
    s += Math.min(12, inf * 4);
    señales.push(`${inf} infracción(es) registradas`);
  }

  return { score: clamp(s), señales };
}

function confianzaDe(c: ContratistaInput): ConfianzaCredito {
  const campos = [
    c.licencia_vigente,
    c.años_operando,
    c.tipo_entidad && c.tipo_entidad !== "Unknown" ? c.tipo_entidad : null,
    c.fianza_monto,
    c.permisos_12m,
    c.dor_activo,
    c.profesionalismo_score,
  ];
  // Las señales profundas valen doble: son las que hacen confiable el TIER_S.
  const profundas = [c.fianza_cancelada, c.dor_delincuente, c.deuda_lni, c.suspensiones].filter(
    (v) => v !== null && v !== undefined,
  ).length;

  const presentes = campos.filter((v) => v !== null && v !== undefined).length + profundas * 2;
  if (presentes >= 8) return "alta";
  if (presentes >= 4) return "media";
  return "baja";
}

function rutear(
  fit: number,
  need: number,
  risk: number,
  confianza: ConfianzaCredito,
): { ruta: RutaCredito; motivo: string } {
  if (risk >= 75) {
    return { ruta: "DESCARTE", motivo: "Riesgo demasiado alto (licencia/banderas rojas)." };
  }
  if (confianza === "baja") {
    return {
      ruta: "NURTURE",
      motivo: "Faltan datos duros (fianza/permisos): no alcanza para rutear crédito.",
    };
  }
  if (fit >= 65 && need >= 65 && risk <= 45) {
    return {
      ruta: "TIER_S_FINANCIAMIENTO",
      motivo: "Encaja, necesita capital y el riesgo es manejable.",
    };
  }
  if (risk >= 50 && fit >= 55) {
    return {
      ruta: "TIER_A_BLINDAJE",
      motivo: "Buen encaje pero con riesgo: entra primero por Blindaje L&I.",
    };
  }
  if (fit >= 50 && need >= 45) {
    return { ruta: "TIER_B", motivo: "Prospecto válido de segunda ronda." };
  }
  return { ruta: "NURTURE", motivo: "Todavía no muestra necesidad o encaje suficiente." };
}

export function scoreContratista(c: ContratistaInput): CapitalScore {
  const fit = scoreFit(c);
  const need = scoreNeed(c);
  const risk = scoreRisk(c);
  const confianza = confianzaDe(c);
  const { ruta, motivo } = rutear(fit.score, need.score, risk.score, confianza);
  const total = clamp(fit.score * 0.35 + need.score * 0.4 + (100 - risk.score) * 0.25);

  return {
    ...(c.id ? { id: c.id } : {}),
    nombre: c.nombre,
    fit,
    need,
    risk,
    total,
    ruta,
    confianza,
    motivo,
    scored_at: new Date().toISOString(),
  };
}

export function scoreLote(lista: ContratistaInput[]): CapitalScore[] {
  return lista.map(scoreContratista).sort((a, b) => b.total - a.total);
}

/** Las 3 señales más fuertes para armar el guion de llamada. */
export function ganchosParaGuion(score: CapitalScore, max = 3): string[] {
  const pool = [
    ...score.need.señales.map((s) => ({ s, peso: score.need.score })),
    ...score.fit.señales.map((s) => ({ s, peso: score.fit.score * 0.8 })),
    ...score.risk.señales.map((s) => ({ s, peso: score.risk.score * 0.6 })),
  ];
  return pool
    .sort((a, b) => b.peso - a.peso)
    .map((p) => p.s)
    .filter((s, i, arr) => arr.indexOf(s) === i)
    .slice(0, max);
}

export const RUTA_LABELS: Record<RutaCredito, string> = {
  TIER_S_FINANCIAMIENTO: "Priority to qualify",
  TIER_A_BLINDAJE: "Verify before financing",
  TIER_B: "Secondary prospect",
  NURTURE: "Needs more evidence",
  DESCARTE: "Not a current fit",
};
