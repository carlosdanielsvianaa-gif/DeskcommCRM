import { describe, expect, it } from "vitest";

import { substituirVariaveis } from "@/lib/propostas/documento/variaveis";
import type { EntradaSolarValidada } from "@/lib/schemas/solar";

import { montarPropostaSolar } from "./briefing";
import { ENTRADA_SOLAR_PADRAO } from "./calculo";
import { MODELO_ENERGIA_SOLAR } from "./modelo-de-proposta";

const entrada: EntradaSolarValidada = {
  ...ENTRADA_SOLAR_PADRAO,
  consumo_medio_kwh: 500,
  hsp: 5.4,
  ano_inicio: 2026,
  uf: "MG",
  cidade: "Belo Horizonte",
  marca_modulo: "Marca X",
  marca_inversor: "Marca Y",
  tipo_telhado: "cerâmico",
  concessionaria: "Distribuidora Z",
};

describe("montarPropostaSolar", () => {
  it("preenche TODA variável solar.* do modelo — nenhuma sai como [a definir]", () => {
    const { briefing } = montarPropostaSolar(entrada);
    const dados = {
      ...briefing,
      client: { company_or_name: "Cliente" },
      investment: { total_formatted: "R$ 1,00" },
      commercial_terms: { validity_days: 15 },
      approval: { date: "____" },
    };
    const faltantes = MODELO_ENERGIA_SOLAR.sections.flatMap((s) => substituirVariaveis(s.body, dados).faltantes);
    expect(faltantes).toEqual([]);
  });

  it("formata em pt-BR e o item leva o investimento em centavos", () => {
    const { briefing, item, resultado } = montarPropostaSolar(entrada);
    expect(briefing.solar.local).toBe("Belo Horizonte/MG");
    expect(briefing.solar.potencia_kwp).toBe("3,66");
    expect(item.preco_unitario_cents).toBe(Math.round(resultado.investimento * 100));
    expect(item.descricao).toContain("6 módulos Marca X de 610 W");
  });
});
