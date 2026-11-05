/**
 * OS QUATRO INDICADORES DO TOPO DA LISTA DE PROPOSTAS — quantas propostas e
 * quanto somam, quantas foram aceitas, a taxa de aceite e a potência total
 * proposta (kWp, das propostas de energia solar).
 *
 * Substituída (versão velha da mesma proposta) e cancelada ficam fora da conta:
 * a mesma proposta não conta duas vezes. A taxa de aceite é sobre as que já
 * tiveram resposta possível — enviadas, aceitas, recusadas e vencidas —, porque
 * rascunho ainda não foi oferecido a ninguém.
 */

export interface PropostaParaIndicadores {
  status: string;
  total_cents: number;
  solar?: Record<string, unknown> | null;
}

export interface IndicadoresDePropostas {
  propostas: { quantidade: number; valor_cents: number };
  aceitas: { quantidade: number; valor_cents: number };
  /** 0–100, ou `null` sem nenhuma proposta oferecida. */
  taxa_de_aceite: number | null;
  potencia_kwp: number;
}

/** "5,49" / "1.234,5" (pt-BR, como o briefing grava) → número. */
export function numeroDoBriefing(valor: unknown): number | null {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (typeof valor !== "string" || valor.trim() === "") return null;
  const n = Number(valor.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

const OFERECIDAS = new Set(["enviada", "aceita", "recusada", "vencida"]);

export function calcularIndicadores(lista: readonly PropostaParaIndicadores[]): IndicadoresDePropostas {
  const out: IndicadoresDePropostas = {
    propostas: { quantidade: 0, valor_cents: 0 },
    aceitas: { quantidade: 0, valor_cents: 0 },
    taxa_de_aceite: null,
    potencia_kwp: 0,
  };
  let oferecidas = 0;
  for (const p of lista) {
    if (p.status === "substituida" || p.status === "cancelada") continue;
    out.propostas.quantidade += 1;
    out.propostas.valor_cents += p.total_cents;
    if (OFERECIDAS.has(p.status)) oferecidas += 1;
    if (p.status === "aceita") {
      out.aceitas.quantidade += 1;
      out.aceitas.valor_cents += p.total_cents;
    }
    out.potencia_kwp += numeroDoBriefing(p.solar?.potencia_kwp) ?? 0;
  }
  if (oferecidas > 0) out.taxa_de_aceite = (out.aceitas.quantidade / oferecidas) * 100;
  return out;
}
