/**
 * DIMENSIONAMENTO DE UM SISTEMA FOTOVOLTAICO ON-GRID — função pura.
 *
 * Não lê banco, não lê relógio, não formata texto: recebe números, devolve
 * números. A tela usa para mostrar o resultado enquanto a pessoa digita; a rota
 * de propostas usa de novo no servidor, com a MESMA entrada, para que o PDF
 * nunca leve um número que o navegador inventou.
 *
 * O modelo é o usual de orçamento comercial (não substitui o projeto
 * elétrico):
 *
 *   energia a compensar = consumo − custo de disponibilidade da ligação
 *   kWp necessário      = energia a compensar ÷ (HSP × 30 × rendimento)
 *   módulos             = arredonda PARA CIMA (kWp × 1000 ÷ potência do módulo)
 *   geração mensal      = kWp instalado × HSP × 30 × rendimento
 *
 * A economia do ano 1 é a energia compensada × tarifa × (1 − parcela do Fio B
 * que não se compensa). Nos anos seguintes a tarifa sobe pelo reajuste e a
 * geração cai pela degradação dos módulos. O payback é o primeiro ponto em que
 * a economia acumulada alcança o investimento, interpolado dentro do ano.
 */

export type TipoDeLigacao = "monofasica" | "bifasica" | "trifasica";

/** Custo de disponibilidade (REN ANEEL 1.000/2021): o mínimo que a conta cobra. */
export const DISPONIBILIDADE_KWH: Readonly<Record<TipoDeLigacao, number>> = Object.freeze({
  monofasica: 30,
  bifasica: 50,
  trifasica: 100,
});

/** Potências comerciais de inversor string, em kW, para a sugestão. */
export const POTENCIAS_DE_INVERSOR_KW: readonly number[] = Object.freeze([
  1.5, 2, 3, 3.6, 4, 5, 6, 7.5, 8, 10, 12, 15, 20, 25, 30, 36, 40, 50, 60, 75, 100,
]);

/**
 * Quanto a potência dos módulos pode passar a do inversor (relação CC/CA).
 * 1,25 é conservador para o Brasil; a sugestão é só um ponto de partida.
 */
export const SOBRECARGA_DO_INVERSOR = 1.25;

export interface EntradaSolar {
  consumo_medio_kwh: number;
  tipo_ligacao: TipoDeLigacao;
  hsp: number;
  potencia_modulo_w: number;
  area_modulo_m2: number;
  rendimento_pct: number;
  tarifa_kwh: number;
  fio_b_pct: number;
  preco_por_wp: number;
  reajuste_tarifa_pct_ano: number;
  degradacao_pct_ano: number;
  anos_analise: number;
}

export const ENTRADA_SOLAR_PADRAO: Readonly<Omit<EntradaSolar, "consumo_medio_kwh" | "hsp">> = Object.freeze({
  tipo_ligacao: "bifasica",
  potencia_modulo_w: 610,
  area_modulo_m2: 2.6,
  rendimento_pct: 80,
  tarifa_kwh: 0.95,
  fio_b_pct: 15,
  preco_por_wp: 3.5,
  reajuste_tarifa_pct_ano: 6,
  degradacao_pct_ano: 0.5,
  anos_analise: 25,
});

export interface AnoDoFluxo {
  ano: number;
  geracao_kwh: number;
  economia: number;
  acumulado: number;
}

export interface ResultadoSolar {
  energia_compensavel_kwh: number;
  potencia_necessaria_kwp: number;
  quantidade_modulos: number;
  potencia_kwp: number;
  inversor_kw: number;
  geracao_mensal_kwh: number;
  geracao_anual_kwh: number;
  area_m2: number;
  cobertura_pct: number;
  conta_atual: number;
  economia_mensal: number;
  economia_anual: number;
  investimento: number;
  /** `null` quando a economia do período não paga o investimento. */
  payback_anos: number | null;
  economia_total_periodo: number;
  retorno_pct: number;
  fluxo: AnoDoFluxo[];
}

function arredondar(valor: number, casas: number): number {
  const fator = 10 ** casas;
  return Math.round(valor * fator) / fator;
}

export function sugerirInversorKw(potenciaKwp: number): number {
  const minimo = potenciaKwp / SOBRECARGA_DO_INVERSOR;
  return POTENCIAS_DE_INVERSOR_KW.find((p) => p >= minimo) ?? POTENCIAS_DE_INVERSOR_KW[POTENCIAS_DE_INVERSOR_KW.length - 1]!;
}

export function calcularSistemaSolar(entrada: EntradaSolar): ResultadoSolar {
  const rendimento = entrada.rendimento_pct / 100;
  const diasPorMes = 30;
  const energiaCompensavel = Math.max(entrada.consumo_medio_kwh - DISPONIBILIDADE_KWH[entrada.tipo_ligacao], 0);

  const potenciaNecessaria = energiaCompensavel / (entrada.hsp * diasPorMes * rendimento);
  // Um sistema existe com pelo menos um módulo; consumo abaixo da
  // disponibilidade dá zero módulos, e a tela explica que não compensa.
  const quantidadeModulos = energiaCompensavel > 0 ? Math.ceil((potenciaNecessaria * 1000) / entrada.potencia_modulo_w) : 0;
  const potenciaKwp = (quantidadeModulos * entrada.potencia_modulo_w) / 1000;
  const geracaoMensal = potenciaKwp * entrada.hsp * diasPorMes * rendimento;

  const tarifaEfetiva = entrada.tarifa_kwh * (1 - entrada.fio_b_pct / 100);
  const investimento = potenciaKwp * 1000 * entrada.preco_por_wp;

  const fluxo: AnoDoFluxo[] = [];
  let acumulado = 0;
  let payback: number | null = null;
  for (let ano = 1; ano <= entrada.anos_analise; ano++) {
    const geracaoDoAno = geracaoMensal * 12 * (1 - entrada.degradacao_pct_ano / 100) ** (ano - 1);
    const tarifaDoAno = tarifaEfetiva * (1 + entrada.reajuste_tarifa_pct_ano / 100) ** (ano - 1);
    const compensadaNoAno = Math.min(geracaoDoAno, energiaCompensavel * 12);
    const economiaDoAno = compensadaNoAno * tarifaDoAno;
    const antes = acumulado;
    acumulado += economiaDoAno;
    if (payback === null && investimento > 0 && acumulado >= investimento && economiaDoAno > 0) {
      payback = ano - 1 + (investimento - antes) / economiaDoAno;
    }
    fluxo.push({
      ano,
      geracao_kwh: arredondar(geracaoDoAno, 0),
      economia: arredondar(economiaDoAno, 2),
      acumulado: arredondar(acumulado, 2),
    });
  }

  const economiaMensal = Math.min(geracaoMensal, energiaCompensavel) * tarifaEfetiva;
  const cobertura = entrada.consumo_medio_kwh > 0 ? Math.min(geracaoMensal / entrada.consumo_medio_kwh, 1) : 0;

  return {
    energia_compensavel_kwh: arredondar(energiaCompensavel, 0),
    potencia_necessaria_kwp: arredondar(potenciaNecessaria, 2),
    quantidade_modulos: quantidadeModulos,
    potencia_kwp: arredondar(potenciaKwp, 2),
    inversor_kw: quantidadeModulos > 0 ? sugerirInversorKw(potenciaKwp) : 0,
    geracao_mensal_kwh: arredondar(geracaoMensal, 0),
    geracao_anual_kwh: arredondar(geracaoMensal * 12, 0),
    area_m2: arredondar(quantidadeModulos * entrada.area_modulo_m2, 1),
    cobertura_pct: arredondar(cobertura * 100, 0),
    conta_atual: arredondar(entrada.consumo_medio_kwh * entrada.tarifa_kwh, 2),
    economia_mensal: arredondar(economiaMensal, 2),
    economia_anual: arredondar(economiaMensal * 12, 2),
    investimento: arredondar(investimento, 2),
    payback_anos: payback === null ? null : arredondar(payback, 1),
    economia_total_periodo: arredondar(acumulado, 2),
    retorno_pct: investimento > 0 ? arredondar(((acumulado - investimento) / investimento) * 100, 0) : 0,
    fluxo,
  };
}
