import { describe, expect, it } from "vitest";

import { lerPlanilhaDeLeads } from "./planilha";
import { resolverExtras, type ContextoDosExtras } from "./planilha-extras";

const ctx: ContextoDosExtras = {
  campos: [
    { key: "consumo_kwh", label: "Consumo (kWh/mês)", type: "number" },
    {
      key: "tipo_cliente",
      label: "Tipo",
      type: "select",
      options: [
        { value: "residencial", label: "Residencial" },
        { value: "comercial", label: "Comercial" },
      ],
    },
    { key: "cidade", label: "Cidade", type: "text" },
    { key: "loja", label: "Loja", type: "searchable_select", allow_new: true, options: [] },
  ],
  etapas: [
    { id: "e-novo", name: "Novo lead", is_won: false, is_lost: false },
    { id: "e-neg", name: "Negociação", is_won: false, is_lost: false },
    { id: "e-ganho", name: "Venda realizada", is_won: true, is_lost: false },
    { id: "e-perda", name: "Perdido", is_won: false, is_lost: true },
  ],
  motivos: ["Parou de responder", "Fechou com concorrente"],
  membros: [{ user_id: "u-rafael", email: "rafael@empresa.com", full_name: "Rafael" }],
};

describe("resolverExtras", () => {
  it("põe etapa, dono e campos do funil onde cada um pertence", () => {
    const r = resolverExtras(
      { status: "NEGOCIAÇÃO", vendedor: "RAFAEL", consumo_kwh: "1.200", tipo: "Comercial", cidade: "Teresina", loja: "IPSOLAR" },
      ctx,
    );
    expect(r.stage_id).toBe("e-neg");
    expect(r.owner_user_id).toBe("u-rafael");
    expect(r.custom_fields).toEqual({ consumo_kwh: 1200, tipo_cliente: "comercial", cidade: "Teresina", loja: "IPSOLAR" });
    expect(r.avisos).toEqual([]);
  });

  it("etapa de ganho é aceita como destino", () => {
    expect(resolverExtras({ etapa: "venda realizada" }, ctx).stage_id).toBe("e-ganho");
  });

  it("motivo da perda manda para a etapa de perda com o rótulo do funil", () => {
    const r = resolverExtras({ "motivo da perda": "PAROU DE RESPONDER" }, ctx);
    expect(r.perda).toEqual({ stage_id: "e-perda", lost_reason: "Parou de responder" });
  });

  it("o que não casa vira aviso, sem derrubar a linha", () => {
    const r = resolverExtras({ etapa: "Etapa que não existe", "motivo da perda": "Sumiu", tipo: "Marciano", vendedor: "Fulano" }, ctx);
    expect(r.stage_id).toBeUndefined();
    expect(r.perda).toBeUndefined();
    expect(r.owner_user_id).toBeUndefined();
    expect(r.custom_fields).toEqual({});
    expect(r.avisos).toHaveLength(3);
  });
});

describe("lerPlanilhaDeLeads — extras", () => {
  it("guarda as colunas que não reconhece, pelo cabeçalho normalizado", () => {
    const r = lerPlanilhaDeLeads("nome,telefone,Etapa,Consumo (kWh/mês)\nAna,11999998888,Negociação,800\n");
    if ("erro" in r) throw new Error(r.erro);
    expect(r.leads[0]!.extras).toEqual({ etapa: "Negociação", "consumo (kwh/mes)": "800" });
  });
});
