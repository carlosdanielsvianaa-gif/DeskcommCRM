"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import type { ApiSuccess } from "@/lib/api/wrappers";
import { formatCents } from "@/lib/money";
import { calcularIndicadores } from "@/lib/propostas/indicadores";
import type { ProposalStatus } from "@/lib/propostas/tipos";

interface PropostaResumo {
  id: string;
  titulo: string;
  status: ProposalStatus;
  total_cents: number;
  moeda: string;
  numero: number | null;
  ano: number | null;
  versao: number;
  created_at: string;
  drafted_by_agent_id: string | null;
  /** `briefing_json.solar` das propostas de energia solar (textos já formatados). */
  solar?: Record<string, string> | null;
}

function campoSolar(p: PropostaResumo, chave: string): string {
  const v = p.solar?.[chave];
  return typeof v === "string" && v !== "" ? v : "—";
}

function aguardaRevisao(p: PropostaResumo): boolean {
  return p.status === "rascunho" && p.drafted_by_agent_id !== null;
}

/** Rascunho da IA primeiro — é o que espera uma decisão; o resto na ordem da rota (mais novo primeiro). */
function ordenarParaRevisao(lista: PropostaResumo[]): PropostaResumo[] {
  return [...lista.filter(aguardaRevisao), ...lista.filter((p) => !aguardaRevisao(p))];
}

export function ProposalsClient({ podeCriar }: { podeCriar: boolean }) {
  const t = useT();
  const statusLabels: Record<ProposalStatus, string> = {
    rascunho: t("Rascunho"),
    enviando: t("Enviando"),
    enviada: t("Enviada"),
    aceita: t("Aceita"),
    recusada: t("Recusada"),
    vencida: t("Vencida"),
    cancelada: t("Cancelada"),
    substituida: t("Substituída"),
  };
  const [propostas, setPropostas] = useState<PropostaResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    apiClient
      .get<ApiSuccess<PropostaResumo[]>>("/api/v1/proposals", {
        signal: controller.signal,
      })
      .then((res) => {
        if (!controller.signal.aborted) setPropostas(ordenarParaRevisao(res.data));
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setErro(true);
        showApiError(error);
      })
      .finally(() => {
        if (!controller.signal.aborted) setCarregando(false);
      });

    return () => controller.abort();
  }, [tentativa]);

  const temSolar = propostas.some((p) => p.solar);
  const ind = calcularIndicadores(propostas);
  const indicadores = [
    { id: "propostas", rotulo: t("Propostas"), valor: String(ind.propostas.quantidade), detalhe: formatCents(ind.propostas.valor_cents, "BRL") },
    { id: "aceitas", rotulo: t("Aceitas"), valor: String(ind.aceitas.quantidade), detalhe: formatCents(ind.aceitas.valor_cents, "BRL") },
    {
      id: "taxa",
      rotulo: t("Taxa de aceite"),
      valor: ind.taxa_de_aceite === null ? "—" : `${ind.taxa_de_aceite.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`,
      detalhe: t("das propostas enviadas"),
    },
    {
      id: "potencia",
      rotulo: t("Potência proposta"),
      valor: ind.potencia_kwp.toLocaleString("pt-BR", { maximumFractionDigits: 2 }),
      detalhe: "kWp",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("Propostas")}</h1>
        {podeCriar ? (
          <Button asChild>
            <Link href="/app/proposals/novo">{t("Nova proposta")}</Link>
          </Button>
        ) : null}
      </header>

      {!carregando && !erro && propostas.length > 0 ? (
        <section
          aria-label={t("Indicadores das propostas")}
          data-testid="indicadores-propostas"
          className="grid grid-cols-2 gap-2 md:grid-cols-4"
        >
          {indicadores.map((i) => (
            <div key={i.id} data-testid={`indicador-${i.id}`} className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">{i.rotulo}</p>
              <p className="text-xl font-semibold tabular-nums">{i.valor}</p>
              <p className="truncate text-xs text-muted-foreground tabular-nums">{i.detalhe}</p>
            </div>
          ))}
        </section>
      ) : null}

      {carregando ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t("Carregando…")}
        </p>
      ) : erro ? (
        <div role="alert" className="space-y-3 rounded-lg border p-4">
          <p className="text-sm">{t("Falha ao listar propostas.")}</p>
          <Button
            variant="outline"
            onClick={() => {
              setErro(false);
              setCarregando(true);
              setTentativa((atual) => atual + 1);
            }}
          >
            {t("Tentar novamente")}
          </Button>
        </div>
      ) : propostas.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          {t("Nenhuma proposta cadastrada ainda.")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm max-md:block">
            <thead className="max-md:hidden">
              <tr className="border-b text-left">
                <th scope="col" className="p-3">{t("Número")}</th>
                <th scope="col" className="p-3">{t("Título")}</th>
                {temSolar ? (
                  <>
                    <th scope="col" className="p-3 text-right">{t("Potência (kWp)")}</th>
                    <th scope="col" className="p-3 text-right">{t("Geração (kWh/mês)")}</th>
                    <th scope="col" className="p-3">{t("Tipo")}</th>
                  </>
                ) : null}
                <th scope="col" className="p-3">{t("Status")}</th>
                <th scope="col" className="p-3 text-right">{t("Valor")}</th>
              </tr>
            </thead>
            <tbody className="divide-y max-md:block">
              {propostas.map((p) => (
                <tr
                  key={p.id}
                  className="max-md:flex max-md:flex-wrap max-md:items-center max-md:gap-x-3 max-md:px-3 max-md:py-2"
                >
                  <td className="whitespace-nowrap p-3 max-md:p-0 max-md:text-xs">
                    {p.numero !== null && p.ano !== null
                      ? `${String(p.numero).padStart(4, "0")}/${p.ano} v${p.versao}`
                      : t("Rascunho")}
                  </td>
                  <td className="p-3 max-md:order-first max-md:basis-full max-md:p-0">
                    <Link
                      href={`/app/proposals/${p.id}`}
                      className="underline underline-offset-4 max-md:flex max-md:min-h-11 max-md:items-center"
                    >
                      {p.titulo}
                    </Link>
                  </td>
                  {temSolar ? (
                    <>
                      <td className="whitespace-nowrap p-3 text-right tabular-nums max-md:p-0 max-md:text-xs">
                        {campoSolar(p, "potencia_kwp")}
                      </td>
                      <td className="whitespace-nowrap p-3 text-right tabular-nums max-md:p-0 max-md:text-xs">
                        {campoSolar(p, "geracao_mensal_kwh")}
                      </td>
                      <td className="p-3 max-md:p-0 max-md:text-xs">{campoSolar(p, "tipo_ligacao")}</td>
                    </>
                  ) : null}
                  <td className="p-3 max-md:p-0 max-md:text-xs">
                    {aguardaRevisao(p) ? (
                      <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                        {t("Aguardando revisão")}
                      </span>
                    ) : (
                      statusLabels[p.status]
                    )}
                  </td>
                  <td className="whitespace-nowrap p-3 text-right tabular-nums max-md:p-0 max-md:text-xs">
                    {formatCents(p.total_cents, p.moeda)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
