import { describe, expect, it } from "vitest";

import { calcularSistemaSolar, ENTRADA_SOLAR_PADRAO, percentualDoFioB, sugerirInversorKw, type EntradaSolar } from "./calculo";
import { ESTADOS_SOLARES, hspDoEstado } from "./irradiacao";

const base: EntradaSolar = {
  ...ENTRADA_SOLAR_PADRAO,
  consumo_medio_kwh: 500,
  hsp: 5.4,
  tipo_ligacao: "bifasica",
  potencia_modulo_w: 610,
  rendimento_pct: 80,
  fio_b_kwh: 0,
  simultaneidade_pct: 30,
  ano_inicio: 2026,
  preco_por_wp: 3,
  tarifa_kwh: 0.95,
};

describe("calcularSistemaSolar", () => {
  it("dimensiona pela energia acima da disponibilidade, arredondando os módulos para cima", () => {
    const r = calcularSistemaSolar(base);
    // 500 − 50 = 450 kWh; 450 ÷ (5,4 × 30 × 0,8) = 3,47 kWp; 3472 W ÷ 610 W = 5,7 → 6 módulos
    expect(r.energia_compensavel_kwh).toBe(450);
    expect(r.potencia_necessaria_kwp).toBeCloseTo(3.47, 2);
    expect(r.quantidade_modulos).toBe(6);
    expect(r.potencia_kwp).toBeCloseTo(3.66, 2);
    expect(r.geracao_mensal_kwh).toBe(474);
    expect(r.area_m2).toBeCloseTo(15.6, 1);
  });

  it("a economia não conta energia gerada além do que se compensa", () => {
    const r = calcularSistemaSolar(base);
    expect(r.economia_mensal).toBeCloseTo(450 * 0.95, 2);
  });

  it("o Fio B do ano 1 incide só sobre a parte injetada, no percentual do ano", () => {
    const sem = calcularSistemaSolar(base);
    const com = calcularSistemaSolar({ ...base, fio_b_kwh: 0.4 });
    // 2026 → 60%; 70% injetado; 450 kWh/mês aproveitados
    const desconto = 450 * 0.7 * 0.4 * 0.6;
    expect(com.economia_mensal).toBeCloseTo(sem.economia_mensal - desconto, 1);
    expect(com.payback_anos!).toBeGreaterThan(sem.payback_anos!);
  });

  it("mais consumo simultâneo, menos Fio B pago", () => {
    const pouca = calcularSistemaSolar({ ...base, fio_b_kwh: 0.4, simultaneidade_pct: 10 });
    const muita = calcularSistemaSolar({ ...base, fio_b_kwh: 0.4, simultaneidade_pct: 60 });
    expect(muita.economia_mensal).toBeGreaterThan(pouca.economia_mensal);
  });

  it("a escada do Fio B pesa mais a cada ano até 2029", () => {
    const r = calcularSistemaSolar({ ...base, fio_b_kwh: 0.4, reajuste_tarifa_pct_ano: 0, degradacao_pct_ano: 0 });
    // sem reajuste nem degradação, a economia só cai porque o Fio B sobe
    expect(r.fluxo[1]!.economia).toBeLessThan(r.fluxo[0]!.economia);
    expect(r.fluxo[3]!.economia).toBeLessThan(r.fluxo[2]!.economia);
    expect(r.fluxo[4]!.economia).toBe(r.fluxo[3]!.economia); // 2030 = 2029 = 100%
  });

  it("payback é o ponto em que o acumulado alcança o investimento", () => {
    const r = calcularSistemaSolar(base);
    expect(r.investimento).toBeCloseTo(3660 * 3, 2);
    const anoInteiro = Math.ceil(r.payback_anos!);
    expect(r.fluxo[anoInteiro - 1]!.acumulado).toBeGreaterThanOrEqual(r.investimento);
    if (anoInteiro > 1) expect(r.fluxo[anoInteiro - 2]!.acumulado).toBeLessThan(r.investimento);
  });

  it("payback nulo quando o período não paga o investimento", () => {
    const r = calcularSistemaSolar({ ...base, preco_por_wp: 50, anos_analise: 3, reajuste_tarifa_pct_ano: 0 });
    expect(r.payback_anos).toBeNull();
  });

  it("consumo abaixo da disponibilidade não gera sistema", () => {
    const r = calcularSistemaSolar({ ...base, consumo_medio_kwh: 40 });
    expect(r.quantidade_modulos).toBe(0);
    expect(r.inversor_kw).toBe(0);
    expect(r.investimento).toBe(0);
    expect(r.payback_anos).toBeNull();
  });

  it("o fluxo tem um ano por ano de análise", () => {
    expect(calcularSistemaSolar({ ...base, anos_analise: 25 }).fluxo).toHaveLength(25);
  });
});

describe("percentualDoFioB", () => {
  it("segue o art. 27 da Lei 14.300 e assume 100% de 2029 em diante", () => {
    expect([2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2035].map(percentualDoFioB)).toEqual([
      0, 15, 30, 45, 60, 75, 90, 100, 100,
    ]);
  });
});

describe("sugerirInversorKw", () => {
  it("escolhe a menor potência comercial que aguenta a sobrecarga de 1,25", () => {
    expect(sugerirInversorKw(3.66)).toBe(3);
    expect(sugerirInversorKw(5)).toBe(4);
    expect(sugerirInversorKw(10)).toBe(8);
  });
});

describe("irradiação por estado", () => {
  it("cobre as 27 unidades da federação, com HSP plausível", () => {
    expect(ESTADOS_SOLARES).toHaveLength(27);
    for (const e of ESTADOS_SOLARES) {
      expect(e.hsp).toBeGreaterThan(4);
      expect(e.hsp).toBeLessThan(6.5);
    }
  });

  it("acha pelo UF sem diferenciar maiúscula", () => {
    expect(hspDoEstado("mg")).toBe(5.4);
    expect(hspDoEstado("XX")).toBeNull();
  });
});
