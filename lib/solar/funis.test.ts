import { describe, expect, it } from "vitest";

import { customFieldSchema } from "@/lib/schemas/settings";

import { MODELOS_DE_FUNIL, MODELOS_DE_FUNIL_SOLAR } from "./funis";

describe("funis prontos de energia solar", () => {
  it.each(MODELOS_DE_FUNIL_SOLAR)("%s: exatamente uma etapa de ganho e uma de perda, slugs únicos", (modelo) => {
    const { etapas } = MODELOS_DE_FUNIL[modelo];
    expect(etapas.filter((e) => e.is_won)).toHaveLength(1);
    expect(etapas.filter((e) => e.is_lost)).toHaveLength(1);
    expect(new Set(etapas.map((e) => e.slug)).size).toBe(etapas.length);
  });

  it.each(MODELOS_DE_FUNIL_SOLAR)("%s: todo campo é uma definição válida do funil (senão a tela o descarta)", (modelo) => {
    const { campos } = MODELOS_DE_FUNIL[modelo];
    for (const campo of campos) expect(customFieldSchema.safeParse(campo).success, campo.key).toBe(true);
    expect(new Set(campos.map((c) => c.key)).size).toBe(campos.length);
  });

  it("os campos do sistema têm a mesma chave nos dois funis — o negócio leva o valor quando passa de um para o outro", () => {
    const chaves = (m: (typeof MODELOS_DE_FUNIL_SOLAR)[number]) => new Set(MODELOS_DE_FUNIL[m].campos.map((c) => c.key));
    const vendas = chaves("energia_solar_vendas");
    for (const chave of ["consumo_kwh", "tipo_cliente", "cidade", "uf", "potencia_kwp"]) {
      expect(vendas.has(chave)).toBe(true);
      expect(chaves("energia_solar_obra").has(chave)).toBe(true);
    }
  });
});
