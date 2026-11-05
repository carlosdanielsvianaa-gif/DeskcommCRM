import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { roleAtLeast } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";
import { MODELOS_DE_FUNIL, MODELOS_DE_FUNIL_SOLAR } from "@/lib/solar/funis";

import type { LeadOption } from "../proposals/novo/_client";
import { CalculadoraSolarClient, type FunilSolarNaTela } from "./_client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Energia solar" };

type LinhaDeLead = {
  id: string;
  title: string | null;
  contact_id: string;
  contacts:
    | { id: string; name: string | null; display_name: string | null; phone_number: string | null }
    | Array<{ id: string; name: string | null; display_name: string | null; phone_number: string | null }>
    | null;
};

/**
 * Calculadora de dimensionamento solar. Quem pode criar proposta (agent ou
 * acima, fora de suporte só-leitura) vê também o botão que gera a proposta;
 * os demais usam a calculadora para simular.
 */
export default async function CalculadoraSolarPage({
  searchParams,
}: {
  searchParams?: Promise<{ lead_id?: string }>;
}) {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");

  const podeCriarProposta =
    roleAtLeast(activeOrg.role, "agent") &&
    (!user.support || (user.support.status === "active" && user.support.access_mode === "full"));

  const sp = searchParams ? await searchParams : undefined;

  const supabase = await createClient();

  // Os funis prontos já criados nesta organização, reconhecidos pelo nome com
  // que o modelo os cria (a pessoa pode renomear — aí o botão volta a oferecer).
  const { data: funisData } = await supabase
    .from("crm_pipelines")
    .select("id, name, is_archived")
    .eq("organization_id", activeOrg.orgId);
  const funisAtivos = ((funisData ?? []) as Array<{ id: string; name: string; is_archived: boolean | null }>).filter(
    (f) => !f.is_archived,
  );
  const funis: FunilSolarNaTela[] = MODELOS_DE_FUNIL_SOLAR.map((modelo) => {
    const m = MODELOS_DE_FUNIL[modelo];
    return {
      modelo,
      nome: m.nome,
      descricao: m.descricao,
      etapas: m.etapas.map((e) => e.name),
      id: funisAtivos.find((f) => f.name.trim() === m.nome)?.id ?? null,
    };
  });

  let leads: LeadOption[] = [];
  if (podeCriarProposta) {
    const { data } = await supabase
      .from("crm_leads")
      .select("id, title, contact_id, contacts ( id, name, display_name, phone_number )")
      .eq("organization_id", activeOrg.orgId)
      .not("contact_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(300);
    leads = ((data ?? []) as unknown as LinhaDeLead[]).map((item) => {
      const contact = Array.isArray(item.contacts) ? (item.contacts[0] ?? null) : item.contacts;
      return { id: item.id, title: item.title, contact_id: item.contact_id, contact };
    });
  }

  return (
    <CalculadoraSolarClient
      leads={leads}
      podeCriarProposta={podeCriarProposta}
      funis={funis}
      podeCriarFunil={roleAtLeast(activeOrg.role, "manager") && !user.support}
      preselectedLeadId={sp?.lead_id}
    />
  );
}
