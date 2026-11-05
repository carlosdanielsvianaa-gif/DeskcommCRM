import { describe, expect, it } from "vitest";

import { somarTotais } from "./totais-do-funil";

describe("somarTotais", () => {
  it("conta propostas sem as substituídas e canceladas, separa as aceitas e soma as vendas", () => {
    const r = somarTotais(
      [
        { status: "enviada", total_cents: 1_000_00 },
        { status: "aceita", total_cents: 2_000_00 },
        { status: "substituida", total_cents: 9_999_00 },
        { status: "cancelada", total_cents: 9_999_00 },
        { status: "rascunho", total_cents: null },
      ],
      [{ value_cents: 2_000_00 }, { value_cents: null }],
    );
    expect(r.propostas).toEqual({ quantidade: 3, valor_cents: 3_000_00 });
    expect(r.aceitas).toEqual({ quantidade: 1, valor_cents: 2_000_00 });
    expect(r.vendas).toEqual({ quantidade: 2, valor_cents: 2_000_00 });
  });

  it("funil vazio dá zero em tudo", () => {
    const r = somarTotais([], []);
    expect(r.vendas).toEqual({ quantidade: 0, valor_cents: 0 });
  });
});
