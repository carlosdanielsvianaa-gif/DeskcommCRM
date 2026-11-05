import type { createClient } from "@/lib/supabase/server";

/**
 * OS TOTAIS DO TOPO DO FUNIL — Propostas, Aceitas e Vendas, cada um com a
 * quantidade e a soma em dinheiro, como o operador de energia solar acompanha.
 *
 *   Propostas → toda proposta dos negócios deste funil, menos as substituídas
 *               por versão nova (a mesma proposta não conta duas vezes) e as
 *               canceladas;
 *   Aceitas   → as propostas com status `aceita`;
 *   Vendas    → os negócios do funil com status `won`, pelo `value_cents`.
 *
 * A soma é pura (`somarTotais`) e a leitura pagina de mil em mil: o PostgREST
 * corta toda resposta em `max-rows`, e um funil migrado de outro CRM passa
 * fácil de mil negócios — um total que parasse no milésimo mentiria calado.
 */

export interface TotalDoFunil {
  quantidade: number;
  valor_cents: number;
}

export interface TotaisDoFunil {
  propostas: TotalDoFunil;
  aceitas: TotalDoFunil;
  vendas: TotalDoFunil;
}

export interface LinhaDeProposta {
  status: string;
  total_cents: number | null;
}

export interface LinhaDeVenda {
  value_cents: number | null;
}

const FORA_DA_CONTA = new Set(["substituida", "cancelada"]);

export function somarTotais(propostas: readonly LinhaDeProposta[], vendas: readonly LinhaDeVenda[]): TotaisDoFunil {
  const zero = (): TotalDoFunil => ({ quantidade: 0, valor_cents: 0 });
  const out: TotaisDoFunil = { propostas: zero(), aceitas: zero(), vendas: zero() };
  for (const p of propostas) {
    if (FORA_DA_CONTA.has(p.status)) continue;
    out.propostas.quantidade += 1;
    out.propostas.valor_cents += p.total_cents ?? 0;
    if (p.status === "aceita") {
      out.aceitas.quantidade += 1;
      out.aceitas.valor_cents += p.total_cents ?? 0;
    }
  }
  for (const v of vendas) {
    out.vendas.quantidade += 1;
    out.vendas.valor_cents += v.value_cents ?? 0;
  }
  return out;
}

const PAGINA = 1000;
const MAX_PAGINAS = 100;

type Cliente = Awaited<ReturnType<typeof createClient>>;

async function lerTudo<T>(
  ler: (de: number, ate: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const linhas: T[] = [];
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const de = pagina * PAGINA;
    const { data, error } = await ler(de, de + PAGINA - 1);
    if (error) throw new Error(error.message);
    linhas.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGINA) break;
  }
  return linhas;
}

/**
 * Lê e soma. Devolve `null` em qualquer falha: o topo some e o quadro abre
 * normalmente — um total é informação, não pode derrubar a tela do funil.
 */
export async function lerTotaisDoFunil(
  supabase: Cliente,
  organizationId: string,
  pipelineId: string,
): Promise<TotaisDoFunil | null> {
  try {
    const [propostas, vendas] = await Promise.all([
      lerTudo<LinhaDeProposta>((de, ate) =>
        supabase
          .from("crm_proposals")
          .select("status, total_cents, crm_leads!inner(pipeline_id)")
          .eq("organization_id", organizationId)
          .eq("crm_leads.pipeline_id", pipelineId)
          .order("id")
          .range(de, ate),
      ),
      lerTudo<LinhaDeVenda>((de, ate) =>
        supabase
          .from("crm_leads")
          .select("value_cents")
          .eq("organization_id", organizationId)
          .eq("pipeline_id", pipelineId)
          .eq("status", "won")
          .order("id")
          .range(de, ate),
      ),
    ]);
    return somarTotais(propostas, vendas);
  } catch {
    return null;
  }
}
