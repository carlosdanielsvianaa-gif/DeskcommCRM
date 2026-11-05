import type { CustomFieldDef } from "@/lib/schemas/settings";

import { normalizarCabecalho } from "./planilha";

/**
 * AS COLUNAS A MAIS DA PLANILHA DE LEADS — o que um CRM antigo exporta além de
 * nome, telefone e valor.
 *
 * Função pura: recebe as células que `lerPlanilhaDeLeads` não reconheceu
 * (`extras`, já com o cabeçalho normalizado) e o que o funil de destino
 * conhece, e devolve onde cada uma pousa. Nada aqui escreve: quem grava é a
 * rota, pelo mesmo `createLeadHandler` de sempre.
 *
 *   etapa              → a etapa do funil com esse nome (sem acento/caixa)
 *   motivo da perda    → o negócio nasce PERDIDO, com o motivo do funil
 *   vendedor           → o dono, por e-mail ou nome de quem é da empresa
 *   <campo do funil>   → `custom_fields`, pela chave ou pelo rótulo
 *
 * O que não casa não derruba a linha: vira aviso, e o negócio entra com o
 * resto. Uma migração de 2 mil linhas que para na primeira etapa com nome
 * diferente é pior do que uma que entra e diz o que ficou de fora.
 */

export const COLUNAS_DA_ETAPA = ["etapa", "status", "fase", "estagio"].map(normalizarCabecalho);
export const COLUNAS_DO_MOTIVO = ["motivo da perda", "motivo de perda", "motivo"].map(normalizarCabecalho);
export const COLUNAS_DO_VENDEDOR = ["vendedor", "dono", "dono do negocio", "responsavel pelo negocio"].map(
  normalizarCabecalho,
);

export interface EtapaConhecida {
  id: string;
  name: string;
  is_won: boolean;
  is_lost: boolean;
}

export interface MembroConhecido {
  user_id: string;
  email: string | null;
  full_name: string | null;
}

export interface ContextoDosExtras {
  campos: readonly CustomFieldDef[];
  etapas: readonly EtapaConhecida[];
  /** Rótulos aceitos pelo funil (`settings.lost_reasons`). */
  motivos: readonly string[];
  membros: readonly MembroConhecido[];
}

export interface ExtrasResolvidos {
  /** Etapa ABERTA ou de ganho onde o negócio nasce; ausente = a escolhida na tela. */
  stage_id?: string;
  /** Presente = o negócio vai para a etapa de perda com este motivo. */
  perda?: { stage_id: string; lost_reason: string };
  owner_user_id?: string;
  custom_fields: Record<string, unknown>;
  avisos: string[];
  /** Cabeçalhos que algum destino usou — para não listá-los como ignorados. */
  usadas: string[];
}

const igual = (a: string, b: string) => normalizarCabecalho(a) === normalizarCabecalho(b);

function primeiraDe(extras: Record<string, string>, colunas: readonly string[]): [string, string] | null {
  for (const c of colunas) if (extras[c] !== undefined) return [c, extras[c]!];
  return null;
}

function numero(texto: string): number | null {
  const limpo = texto.replace(/[^\d,.-]/g, "");
  if (limpo === "") return null;
  // "1.200,50" e "1.200" são pt-BR (ponto de milhar); "0.84" e "1500" seguem como estão.
  const soMilhar = /^-?\d{1,3}(\.\d{3})+$/.test(limpo);
  const n = Number(
    limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : soMilhar ? limpo.replace(/\./g, "") : limpo,
  );
  return Number.isFinite(n) ? n : null;
}

function valorDoCampo(campo: CustomFieldDef, texto: string): unknown | null {
  switch (campo.type) {
    case "number":
    case "currency":
      return numero(texto);
    case "boolean": {
      const t = normalizarCabecalho(texto);
      if (["sim", "s", "true", "1", "yes"].includes(t)) return true;
      if (["nao", "n", "false", "0", "no"].includes(t)) return false;
      return null;
    }
    case "select":
    case "searchable_select": {
      const opcao = (campo.options ?? []).find(
        (o) => igual(o.value, texto) || igual(o.label, texto) || (o.aliases ?? []).some((a) => igual(a, texto)),
      );
      if (opcao) return opcao.value;
      return campo.allow_new ? texto : null;
    }
    case "file":
    case "multiselect":
      return null;
    default:
      return texto;
  }
}

export function resolverExtras(extras: Record<string, string>, ctx: ContextoDosExtras): ExtrasResolvidos {
  const out: ExtrasResolvidos = { custom_fields: {}, avisos: [], usadas: [] };

  const motivo = primeiraDe(extras, COLUNAS_DO_MOTIVO);
  if (motivo) {
    out.usadas.push(motivo[0]);
    const etapaDePerda = ctx.etapas.find((e) => e.is_lost);
    const rotulo = ctx.motivos.find((m) => igual(m, motivo[1]));
    if (!etapaDePerda) out.avisos.push(`o funil não tem etapa de perda — "${motivo[1]}" ficou de fora`);
    else if (!rotulo) out.avisos.push(`motivo de perda "${motivo[1]}" não existe neste funil`);
    else out.perda = { stage_id: etapaDePerda.id, lost_reason: rotulo };
  }

  const etapa = primeiraDe(extras, COLUNAS_DA_ETAPA);
  if (etapa) {
    out.usadas.push(etapa[0]);
    const achada = ctx.etapas.find((e) => !e.is_lost && igual(e.name, etapa[1]));
    if (achada) out.stage_id = achada.id;
    else if (!out.perda) out.avisos.push(`etapa "${etapa[1]}" não existe neste funil — entrou na etapa escolhida`);
  }

  const vendedor = primeiraDe(extras, COLUNAS_DO_VENDEDOR);
  if (vendedor) {
    out.usadas.push(vendedor[0]);
    const membro = ctx.membros.find(
      (m) => (m.email && igual(m.email, vendedor[1])) || (m.full_name && igual(m.full_name, vendedor[1])),
    );
    if (membro) out.owner_user_id = membro.user_id;
  }

  for (const campo of ctx.campos) {
    if (campo.escopo === "contato") continue;
    const coluna = [campo.key, campo.label].map(normalizarCabecalho).find((c) => extras[c] !== undefined);
    if (!coluna) continue;
    out.usadas.push(coluna);
    const valor = valorDoCampo(campo, extras[coluna]!);
    if (valor === null) out.avisos.push(`"${extras[coluna]}" não serve para o campo ${campo.label}`);
    else out.custom_fields[campo.key] = valor;
  }

  return out;
}
