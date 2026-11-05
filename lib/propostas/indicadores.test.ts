import { describe, expect, it } from "vitest";

import { calcularIndicadores, numeroDoBriefing } from "./indicadores";

describe("calcularIndicadores", () => {
  it("conta, soma, mede o aceite e a potência sem as substituídas", () => {
    const r = calcularIndicadores([
      { status: "aceita", total_cents: 2_000_00, solar: { potencia_kwp: "5,49" } },
      { status: "enviada", total_cents: 1_000_00, solar: { potencia_kwp: "3,05" } },
      { status: "rascunho", total_cents: 500_00 },
      { status: "substituida", total_cents: 9_000_00, solar: { potencia_kwp: "9,00" } },
    ]);
    expect(r.propostas).toEqual({ quantidade: 3, valor_cents: 3_500_00 });
    expect(r.aceitas).toEqual({ quantidade: 1, valor_cents: 2_000_00 });
    expect(r.taxa_de_aceite).toBe(50);
    expect(r.potencia_kwp).toBeCloseTo(8.54);
  });

  it("sem proposta oferecida não há taxa", () => {
    expect(calcularIndicadores([{ status: "rascunho", total_cents: 0 }]).taxa_de_aceite).toBeNull();
  });

  it("lê número no formato do briefing", () => {
    expect(numeroDoBriefing("1.234,5")).toBe(1234.5);
    expect(numeroDoBriefing("")).toBeNull();
  });
});
