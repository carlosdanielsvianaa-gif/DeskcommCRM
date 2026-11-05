import { describe, expect, it } from "vitest";

import { calcularSistemaSolar, ENTRADA_SOLAR_PADRAO, sugerirInversorKw, type EntradaSolar } from "./calculo";
import { ESTADOS_SOLARES, hspDoEstado } from "./irradiacao";

const base: EntradaSolar = {
  ...ENTRADA_SOLAR_PADRAO,
  consumo_medio_kwh: 500,
  hsp: 5.4,
  tipo_ligacao: "bifasica",
  potencia_modulo_w: 610,
  rendimento_pct: 80,
  fio_b_pct: 0,
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

  it("o Fio B reduz a economia na mesma proporção", () => {
    const sem = calcularSistemaSolar(base);
    const com = calcularSistemaSolar({ ...base, fio_b_pct: 20 });
    expect(com.economia_mensal).toBeCloseTo(sem.economia_mensal * 0.8, 2);
    expect(com.payback_anos!).toBeGreaterThan(sem.payback_anos!);
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
