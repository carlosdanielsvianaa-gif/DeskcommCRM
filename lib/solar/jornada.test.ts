import { describe, expect, it } from "vitest";

import { MODELOS_DE_FUNIL, MODELOS_DE_FUNIL_SOLAR } from "./funis";
import { posicaoNaJornada } from "./jornada";

describe("posicaoNaJornada", () => {
  it("toda etapa dos funis solares tem lugar na jornada", () => {
    for (const modelo of MODELOS_DE_FUNIL_SOLAR) {
      for (const etapa of MODELOS_DE_FUNIL[modelo].etapas) {
        expect(posicaoNaJornada(etapa.slug), etapa.slug).not.toBeNull();
      }
    }
  });

  it("vendas fica em Proposta; venda realizada passa a Contrato; gerando energia conclui", () => {
    expect(posicaoNaJornada("negociacao")).toEqual({ atual: 0, concluida: false, interrompida: false });
    expect(posicaoNaJornada("venda_realizada")?.atual).toBe(1);
    expect(posicaoNaJornada("instalacao")?.atual).toBe(4);
    expect(posicaoNaJornada("gerando_energia")).toEqual({ atual: 5, concluida: true, interrompida: false });
  });

  it("perda interrompe; etapa de outro funil não mostra jornada", () => {
    expect(posicaoNaJornada("perdido")?.interrompida).toBe(true);
    expect(posicaoNaJornada("qualificacao")).toBeNull();
    expect(posicaoNaJornada(undefined)).toBeNull();
  });
});
