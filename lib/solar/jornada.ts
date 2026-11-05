/**
 * A JORNADA DO CLIENTE SOLAR — os seis marcos que o cliente percorre do
 * orçamento ao sistema ligado, desenhados no dossiê do negócio.
 *
 * O marco sai da ETAPA onde o negócio está, pelo `slug` que os funis prontos
 * de energia solar gravam (`lib/solar/funis.ts`). O slug, e não o nome: o nome
 * a empresa renomeia em Etapas do funil; o slug fica. Etapa que não é de funil
 * solar devolve `null` e a jornada não aparece — o dossiê dos outros funis
 * fica como era.
 */

export const MARCOS_DA_JORNADA = [
  "Proposta",
  "Contrato",
  "Financeiro",
  "Engenharia e Homologação",
  "Instalação",
  "Gerando Energia",
] as const;

export interface PosicaoNaJornada {
  /** Índice em `MARCOS_DA_JORNADA` do marco em andamento. */
  atual: number;
  /** Todos os marcos concluídos (o sistema já gera energia). */
  concluida: boolean;
  /** O negócio foi perdido/cancelado neste marco. */
  interrompida: boolean;
}

const MARCO_DA_ETAPA: Readonly<Record<string, number>> = {
  // Funil de vendas
  novo_lead: 0,
  gerar_proposta: 0,
  proposta_apresentada: 0,
  negociacao: 0,
  venda_realizada: 1,
  // Funil de obra e homologação
  financeiro: 2,
  projeto: 3,
  parecer_de_acesso: 3,
  instalacao: 4,
  vistoria: 4,
  gerando_energia: 5,
};

/** Etapas de perda dos funis solares: a jornada para no primeiro marco do funil. */
const PERDA: Readonly<Record<string, number>> = { perdido: 0, cancelado: 2 };

export function posicaoNaJornada(slug: string | null | undefined): PosicaoNaJornada | null {
  if (!slug) return null;
  if (slug in PERDA) return { atual: PERDA[slug]!, concluida: false, interrompida: true };
  const atual = MARCO_DA_ETAPA[slug];
  if (atual === undefined) return null;
  return { atual, concluida: slug === "gerando_energia", interrompida: false };
}
