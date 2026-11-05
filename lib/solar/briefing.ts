import type { EntradaSolarValidada } from "@/lib/schemas/solar";

import { calcularSistemaSolar, type ResultadoSolar } from "./calculo";

/**
 * Do cálculo para o TEXTO da proposta.
 *
 * O modelo "energia_solar" lê `{{solar.*}}` do `briefing_json` (ver
 * `lib/propostas/documento/montar-dados.ts`), e o renderer escreve o valor
 * como está. Por isso cada número sai daqui JÁ formatado em pt-BR — "3,66",
 * "R$ 427,50" — e a pessoa ainda pode corrigir qualquer um no editor da
 * proposta, que oferece o campo para toda variável vinda do briefing.
 */

const numero = (valor: number, casas = 0) =>
  valor.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

const reais = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ROTULO_DA_LIGACAO: Record<EntradaSolarValidada["tipo_ligacao"], string> = {
  monofasica: "monofásica",
  bifasica: "bifásica",
  trifasica: "trifásica",
};

export interface PropostaSolarMontada {
  resultado: ResultadoSolar;
  briefing: { solar: Record<string, string>; project: { name: string } };
  item: { descricao: string; preco_unitario_cents: number };
}

export function montarPropostaSolar(entrada: EntradaSolarValidada): PropostaSolarMontada {
  const resultado = calcularSistemaSolar(entrada);
  const local = entrada.cidade ? `${entrada.cidade}/${entrada.uf}` : entrada.uf;
  const modulo = entrada.marca_modulo
    ? `${entrada.marca_modulo} de ${entrada.potencia_modulo_w} W`
    : `de ${entrada.potencia_modulo_w} W`;
  const inversor = entrada.marca_inversor
    ? `${entrada.marca_inversor} de ${numero(resultado.inversor_kw, resultado.inversor_kw % 1 === 0 ? 0 : 1)} kW`
    : `de ${numero(resultado.inversor_kw, resultado.inversor_kw % 1 === 0 ? 0 : 1)} kW`;

  const solar: Record<string, string> = {
    local,
    concessionaria: entrada.concessionaria ?? "",
    tipo_ligacao: ROTULO_DA_LIGACAO[entrada.tipo_ligacao] ?? entrada.tipo_ligacao,
    tipo_telhado: entrada.tipo_telhado ?? "",
    consumo_medio_kwh: numero(entrada.consumo_medio_kwh),
    conta_atual: reais(resultado.conta_atual),
    hsp: numero(entrada.hsp, 2),
    potencia_kwp: numero(resultado.potencia_kwp, 2),
    quantidade_modulos: numero(resultado.quantidade_modulos),
    modulo,
    inversor,
    area_m2: numero(resultado.area_m2, 1),
    geracao_mensal_kwh: numero(resultado.geracao_mensal_kwh),
    geracao_anual_kwh: numero(resultado.geracao_anual_kwh),
    cobertura_pct: `${numero(resultado.cobertura_pct)}%`,
    economia_mensal: reais(resultado.economia_mensal),
    economia_anual: reais(resultado.economia_anual),
    investimento: reais(resultado.investimento),
    payback_anos: resultado.payback_anos === null ? "acima do período analisado" : `${numero(resultado.payback_anos, 1)} anos`,
    anos_analise: numero(entrada.anos_analise),
    economia_total_periodo: reais(resultado.economia_total_periodo),
    reajuste_tarifa_pct_ano: `${numero(entrada.reajuste_tarifa_pct_ano, entrada.reajuste_tarifa_pct_ano % 1 === 0 ? 0 : 1)}%`,
    fio_b_regra: `Fio B de ${reais(entrada.fio_b_kwh)}/kWh, com ${numero(entrada.simultaneidade_pct)}% de consumo simultâneo e início em ${entrada.ano_inicio}`,
  };

  const descricao = `Sistema fotovoltaico ${numero(resultado.potencia_kwp, 2)} kWp — ${resultado.quantidade_modulos} módulos ${modulo}, inversor ${inversor}, instalação e homologação`;

  return {
    resultado,
    briefing: { solar, project: { name: `sistema fotovoltaico de ${numero(resultado.potencia_kwp, 2)} kWp` } },
    item: { descricao: descricao.slice(0, 500), preco_unitario_cents: Math.round(resultado.investimento * 100) },
  };
}
