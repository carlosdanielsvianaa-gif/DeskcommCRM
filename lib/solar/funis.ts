import type { CustomFieldDef } from "@/lib/schemas/settings";
import { ESTADOS_SOLARES } from "./irradiacao";

/**
 * OS FUNIS PRONTOS DE ENERGIA SOLAR — criados com um clique pela rota de funis
 * (`POST /api/v1/pipelines` com `modelo`).
 *
 * São dois porque são dois trabalhos: VENDER (do primeiro contato à venda) e
 * ENTREGAR (da venda ao sistema gerando energia). Juntar os dois num quadro só
 * deixaria a coluna "Venda realizada" no meio do funil, e o "Ganho" do
 * relatório de conversão deixaria de querer dizer "vendeu".
 *
 * Os campos são declarações comuns de `pipeline.settings.fields`: a pessoa
 * edita, renomeia ou apaga depois em Etapas do funil, como qualquer outro.
 */

export const MODELOS_DE_FUNIL_SOLAR = ["energia_solar_vendas", "energia_solar_obra"] as const;
export type ModeloDeFunilSolar = (typeof MODELOS_DE_FUNIL_SOLAR)[number];

export interface EtapaDoModelo {
  name: string;
  slug: string;
  is_won: boolean;
  is_lost: boolean;
}

export interface ModeloDeFunil {
  nome: string;
  descricao: string;
  etapas: readonly EtapaDoModelo[];
  campos: readonly CustomFieldDef[];
  /** Os motivos que a etapa de perda oferece (`settings.lost_reasons`). */
  motivosDePerda: readonly string[];
}

const etapa = (name: string, slug: string, fim?: "ganho" | "perdido"): EtapaDoModelo => ({
  name,
  slug,
  is_won: fim === "ganho",
  is_lost: fim === "perdido",
});

const opcoes = (...rotulos: string[]) =>
  rotulos.map((label) => ({
    label,
    value: label
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, ""),
  }));

/** Campos que valem nos dois funis: o negócio que passa de um para o outro leva os valores. */
const CAMPOS_DO_SISTEMA: CustomFieldDef[] = [
  { key: "consumo_kwh", label: "Consumo (kWh/mês)", type: "number" },
  {
    key: "tipo_cliente",
    label: "Tipo",
    type: "select",
    options: opcoes("Residencial", "Comercial", "Rural", "Industrial", "Off Grid", "Usina de investimento"),
  },
  { key: "cidade", label: "Cidade", type: "text" },
  {
    key: "uf",
    label: "UF",
    type: "select",
    options: ESTADOS_SOLARES.map((e) => ({ value: e.uf, label: e.uf })),
  },
  { key: "potencia_kwp", label: "Potência (kWp)", type: "number" },
];

export const MODELOS_DE_FUNIL: Readonly<Record<ModeloDeFunilSolar, ModeloDeFunil>> = Object.freeze({
  energia_solar_vendas: {
    nome: "Vendas — Energia solar",
    descricao: "Do primeiro contato à venda do sistema fotovoltaico.",
    etapas: [
      etapa("Novo lead", "novo_lead"),
      etapa("Gerar proposta", "gerar_proposta"),
      etapa("Proposta apresentada", "proposta_apresentada"),
      etapa("Negociação", "negociacao"),
      etapa("Venda realizada", "venda_realizada", "ganho"),
      etapa("Perdido", "perdido", "perdido"),
    ],
    campos: [
      ...CAMPOS_DO_SISTEMA,
      {
        key: "origem_lead",
        label: "Origem",
        type: "searchable_select",
        allow_new: true,
        options: opcoes(
          "WhatsApp",
          "[Meta] WhatsApp",
          "Instagram",
          "Facebook",
          "Indicação Cliente",
          "Agente Indicador",
          "Direto da Agenda",
          "Fluxo de Loja",
          "Prospecção de Campo",
          "Ligação Recebida",
          "Orçamento Site",
          "Integração de Marketing",
        ),
      },
      { key: "loja", label: "Loja", type: "searchable_select", allow_new: true, options: [] },
      { key: "pre_vendedor", label: "Pré-vendedor", type: "text" },
      { key: "cep", label: "CEP", type: "text" },
    ],
    motivosDePerda: [
      "Parou de responder",
      "Somente curiosidade",
      "Oportunidade futura",
      "Contato inválido",
      "Fechou com concorrente",
      "Crédito não aprovado",
      "Inviabilidade técnica",
    ],
  },
  energia_solar_obra: {
    nome: "Obra e homologação — Energia solar",
    descricao: "Da venda ao sistema gerando energia: financeiro, engenharia, instalação e vistoria.",
    etapas: [
      etapa("Financeiro", "financeiro"),
      etapa("Projeto e engenharia", "projeto"),
      etapa("Parecer de acesso", "parecer_de_acesso"),
      etapa("Instalação", "instalacao"),
      etapa("Vistoria da distribuidora", "vistoria"),
      etapa("Gerando energia", "gerando_energia", "ganho"),
      etapa("Cancelado", "cancelado", "perdido"),
    ],
    campos: [
      ...CAMPOS_DO_SISTEMA,
      { key: "protocolo_distribuidora", label: "Protocolo na distribuidora", type: "text" },
      { key: "data_parecer", label: "Data do parecer de acesso", type: "date" },
      { key: "data_instalacao", label: "Data da instalação", type: "date" },
      { key: "data_vistoria", label: "Data da vistoria", type: "date" },
      { key: "conta_de_luz", label: "Conta de luz", type: "file" },
    ],
    motivosDePerda: ["Desistência do cliente", "Crédito não aprovado", "Inviabilidade técnica", "Reprovado pela distribuidora"],
  },
});
