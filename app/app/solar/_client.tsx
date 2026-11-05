"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Sun } from "lucide-react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import type { ApiSuccess } from "@/lib/api/wrappers";
import { rotuloDoContato } from "@/lib/contacts/rotulo-do-contato";
import { entradaSolarSchema } from "@/lib/schemas/solar";
import { calcularSistemaSolar, ENTRADA_SOLAR_PADRAO, type TipoDeLigacao } from "@/lib/solar/calculo";
import { ESTADOS_SOLARES, hspDoEstado } from "@/lib/solar/irradiacao";

import type { LeadOption } from "../proposals/novo/_client";

export interface FunilSolarNaTela {
  modelo: "energia_solar_vendas" | "energia_solar_obra";
  nome: string;
  descricao: string;
  etapas: string[];
  /** O funil já criado nesta organização, ou `null` se ainda não existe. */
  id: string | null;
}

interface Props {
  leads: LeadOption[];
  podeCriarProposta: boolean;
  funis: FunilSolarNaTela[];
  podeCriarFunil: boolean;
  preselectedLeadId?: string;
}

/** Os campos ficam como TEXTO enquanto a pessoa digita: "0," é um passo válido. */
interface Formulario {
  consumo: string;
  conta: string;
  tipo_ligacao: TipoDeLigacao;
  uf: string;
  cidade: string;
  hsp: string;
  concessionaria: string;
  tipo_telhado: string;
  potencia_modulo_w: string;
  marca_modulo: string;
  marca_inversor: string;
  area_modulo_m2: string;
  tarifa_kwh: string;
  preco_por_wp: string;
  fio_b_kwh: string;
  simultaneidade_pct: string;
  ano_inicio: string;
  reajuste_tarifa_pct_ano: string;
  rendimento_pct: string;
  degradacao_pct_ano: string;
  anos_analise: string;
}

const P = ENTRADA_SOLAR_PADRAO;
/** Chave do formulário (não é texto de tela) — fora do JSX para a guarda de i18n não lê-la como prosa. */
const CAMPO_DO_TELHADO = "tipo_telhado" satisfies keyof Formulario;
const decimal = (n: number) => String(n).replace(".", ",");

const FORMULARIO_INICIAL: Formulario = {
  consumo: "",
  conta: "",
  tipo_ligacao: P.tipo_ligacao,
  uf: "SP",
  cidade: "",
  hsp: decimal(hspDoEstado("SP") ?? 5),
  concessionaria: "",
  tipo_telhado: "",
  potencia_modulo_w: String(P.potencia_modulo_w),
  marca_modulo: "",
  marca_inversor: "",
  area_modulo_m2: decimal(P.area_modulo_m2),
  tarifa_kwh: decimal(P.tarifa_kwh),
  preco_por_wp: decimal(P.preco_por_wp),
  fio_b_kwh: decimal(P.fio_b_kwh),
  simultaneidade_pct: decimal(P.simultaneidade_pct),
  ano_inicio: String(new Date().getFullYear()),
  reajuste_tarifa_pct_ano: decimal(P.reajuste_tarifa_pct_ano),
  rendimento_pct: decimal(P.rendimento_pct),
  degradacao_pct_ano: decimal(P.degradacao_pct_ano),
  anos_analise: String(P.anos_analise),
};

/**
 * O que a pessoa costuma repetir de cliente para cliente (preço, tarifa,
 * equipamento, estado) fica lembrado NESTE navegador — conveniência, não dado
 * do negócio: o que vale para a proposta é o que vai na requisição.
 */
const CHAVE_DOS_PADROES = "solar.padroes.v1";
const CAMPOS_LEMBRADOS = [
  "tipo_ligacao",
  "uf",
  "hsp",
  "concessionaria",
  "potencia_modulo_w",
  "marca_modulo",
  "marca_inversor",
  "area_modulo_m2",
  "tarifa_kwh",
  "preco_por_wp",
  "fio_b_kwh",
  "simultaneidade_pct",
  "reajuste_tarifa_pct_ano",
  "rendimento_pct",
  "degradacao_pct_ano",
  "anos_analise",
] as const satisfies readonly (keyof Formulario)[];

/**
 * "1.234,5" (pt-BR), "1234,5" e "0.95" valem todos: com vírgula, o ponto é
 * separador de milhar; sem vírgula, o ponto é a casa decimal.
 */
function lerNumero(texto: string): number {
  const bruto = texto.trim();
  if (bruto === "") return Number.NaN;
  const limpo = bruto.includes(",") ? bruto.replace(/\./g, "").replace(",", ".") : bruto;
  return Number(limpo);
}

const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (v: number, casas = 0) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

export function CalculadoraSolarClient({ leads, podeCriarProposta, funis, podeCriarFunil, preselectedLeadId }: Props) {
  const t = useT();
  const router = useRouter();
  const [form, setForm] = useState<Formulario>(FORMULARIO_INICIAL);
  const [leadId, setLeadId] = useState<string>(() =>
    preselectedLeadId && leads.some((l) => l.id === preselectedLeadId) ? preselectedLeadId : "",
  );
  const [gerando, setGerando] = useState(false);
  const [criandoFunil, setCriandoFunil] = useState<string | null>(null);

  async function criarFunil(funil: FunilSolarNaTela) {
    setCriandoFunil(funil.modelo);
    try {
      await apiClient.post("/api/v1/pipelines", { name: funil.nome, description: funil.descricao, modelo: funil.modelo });
      router.refresh();
    } catch (err) {
      showApiError(err);
    } finally {
      setCriandoFunil(null);
    }
  }

  // Lê os padrões lembrados DEPOIS da hidratação: ler o navegador no
  // inicializador do useState faria o HTML do servidor divergir do cliente.
  useEffect(() => {
    try {
      const salvo = window.localStorage.getItem(CHAVE_DOS_PADROES);
      if (!salvo) return;
      const padroes = JSON.parse(salvo) as Partial<Formulario>;
      setForm((atual) => {
        const proximo = { ...atual };
        for (const campo of CAMPOS_LEMBRADOS) {
          const valor = padroes[campo];
          if (typeof valor === "string") (proximo as Record<string, string>)[campo] = valor;
        }
        return proximo;
      });
    } catch {
      // Navegador sem storage (janela anônima, bloqueio): segue com o padrão.
    }
  }, []);

  function mudar<K extends keyof Formulario>(campo: K, valor: Formulario[K]) {
    setForm((atual) => {
      const proximo = { ...atual, [campo]: valor };
      if (campo === "uf") {
        const hsp = hspDoEstado(String(valor));
        if (hsp !== null) proximo.hsp = decimal(hsp);
      }
      return proximo;
    });
  }

  // Consumo: o kWh digitado manda; sem ele, a conta em R$ ÷ tarifa estima.
  const tarifa = lerNumero(form.tarifa_kwh);
  const consumoDigitado = lerNumero(form.consumo);
  const contaDigitada = lerNumero(form.conta);
  const consumo =
    Number.isFinite(consumoDigitado) && consumoDigitado > 0
      ? consumoDigitado
      : Number.isFinite(contaDigitada) && contaDigitada > 0 && tarifa > 0
        ? Math.round(contaDigitada / tarifa)
        : Number.NaN;

  const entrada = useMemo(
    () =>
      entradaSolarSchema.safeParse({
        consumo_medio_kwh: consumo,
        tipo_ligacao: form.tipo_ligacao,
        uf: form.uf,
        cidade: form.cidade,
        hsp: lerNumero(form.hsp),
        potencia_modulo_w: lerNumero(form.potencia_modulo_w),
        area_modulo_m2: lerNumero(form.area_modulo_m2),
        rendimento_pct: lerNumero(form.rendimento_pct),
        tarifa_kwh: tarifa,
        fio_b_kwh: lerNumero(form.fio_b_kwh),
        simultaneidade_pct: lerNumero(form.simultaneidade_pct),
        ano_inicio: lerNumero(form.ano_inicio),
        preco_por_wp: lerNumero(form.preco_por_wp),
        reajuste_tarifa_pct_ano: lerNumero(form.reajuste_tarifa_pct_ano),
        degradacao_pct_ano: lerNumero(form.degradacao_pct_ano),
        anos_analise: lerNumero(form.anos_analise),
        marca_modulo: form.marca_modulo,
        marca_inversor: form.marca_inversor,
        tipo_telhado: form.tipo_telhado,
        concessionaria: form.concessionaria,
      }),
    [form, consumo, tarifa],
  );

  const resultado = entrada.success ? calcularSistemaSolar(entrada.data) : null;
  const maiorAcumulado = resultado ? Math.max(resultado.investimento, ...resultado.fluxo.map((f) => f.acumulado), 1) : 1;

  function lembrarPadroes() {
    try {
      const padroes: Partial<Formulario> = {};
      for (const campo of CAMPOS_LEMBRADOS) (padroes as Record<string, string>)[campo] = form[campo];
      window.localStorage.setItem(CHAVE_DOS_PADROES, JSON.stringify(padroes));
    } catch {
      // Sem storage não há o que lembrar; a proposta não depende disso.
    }
  }

  async function gerarProposta() {
    if (!entrada.success || !resultado || !leadId) return;
    setGerando(true);
    lembrarPadroes();
    try {
      const res = await apiClient.post<ApiSuccess<{ id: string }>>("/api/v1/proposals", {
        lead_id: leadId,
        titulo: `Energia solar — ${num(resultado.potencia_kwp, 2)} kWp`,
        itens: [],
        solar: entrada.data,
      });
      router.push(`/app/proposals/${res.data.id}`);
    } catch (err) {
      showApiError(err);
      setGerando(false);
    }
  }

  const campoNumero = (id: keyof Formulario, rotulo: string, ajuda?: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`solar-${id}`}>{rotulo}</Label>
      <Input
        id={`solar-${id}`}
        inputMode="decimal"
        value={form[id]}
        onChange={(e) => mudar(id, e.target.value as never)}
      />
      {ajuda ? <p className="text-xs text-muted-foreground">{ajuda}</p> : null}
    </div>
  );

  const campoTexto = (id: keyof Formulario, rotulo: string, exemplo?: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`solar-${id}`}>{rotulo}</Label>
      <Input
        id={`solar-${id}`}
        value={form[id]}
        placeholder={exemplo}
        maxLength={120}
        onChange={(e) => mudar(id, e.target.value as never)}
      />
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Sun className="h-6 w-6 text-primary" aria-hidden />
          {t("Calculadora de energia solar")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("Dimensione o sistema a partir do consumo do cliente e gere a proposta com economia e retorno do investimento.")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("Funis de energia solar")}</CardTitle>
          <CardDescription>
            {t("Dois funis prontos, com as etapas e os campos do negócio solar (consumo, tipo, cidade, UF, origem e loja). Dá para renomear e ajustar depois em Etapas do funil.")}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {funis.map((funil) => (
            <div key={funil.modelo} className="flex flex-col gap-3 rounded-md border p-4">
              <div className="space-y-1">
                <p className="font-medium">{t(funil.nome)}</p>
                <p className="text-sm text-muted-foreground">{t(funil.descricao)}</p>
              </div>
              <p className="text-xs text-muted-foreground">{funil.etapas.map((e) => t(e)).join(" → ")}</p>
              <div className="mt-auto">
                {funil.id ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/app/pipelines/${funil.id}`}>{t("Abrir funil")}</Link>
                  </Button>
                ) : podeCriarFunil ? (
                  <Button size="sm" onClick={() => criarFunil(funil)} disabled={criandoFunil !== null}>
                    {criandoFunil === funil.modelo ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t("Criando…")}
                      </>
                    ) : (
                      t("Criar este funil")
                    )}
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">{t("Peça a quem gerencia a empresa para criar este funil.")}</p>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("Consumo e local")}</CardTitle>
              <CardDescription>{t("Use a média dos últimos 12 meses da conta de luz.")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {campoNumero("consumo", t("Consumo médio (kWh/mês)"))}
              {campoNumero("conta", t("Ou: valor médio da conta (R$)"), t("Usado só quando o consumo em kWh está vazio."))}
              <div className="space-y-1.5">
                <Label htmlFor="solar-tipo_ligacao">{t("Tipo de ligação")}</Label>
                <Select value={form.tipo_ligacao} onValueChange={(v) => mudar("tipo_ligacao", v as TipoDeLigacao)}>
                  <SelectTrigger id="solar-tipo_ligacao" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monofasica">{t("Monofásica (30 kWh mínimos)")}</SelectItem>
                    <SelectItem value="bifasica">{t("Bifásica (50 kWh mínimos)")}</SelectItem>
                    <SelectItem value="trifasica">{t("Trifásica (100 kWh mínimos)")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="solar-uf">{t("Estado")}</Label>
                <Select value={form.uf} onValueChange={(v) => mudar("uf", v)}>
                  <SelectTrigger id="solar-uf" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {ESTADOS_SOLARES.map((e) => (
                      <SelectItem key={e.uf} value={e.uf}>
                        {e.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {campoTexto("cidade", t("Cidade"))}
              {campoNumero(
                "hsp",
                t("Irradiação (kWh/m²/dia)"),
                t("Média do estado. Para mais precisão, use o valor da cidade no CRESESB SunData."),
              )}
              {campoTexto("concessionaria", t("Distribuidora"), t("Ex.: Cemig, Enel, CPFL"))}
              {campoTexto(CAMPO_DO_TELHADO, t("Tipo de telhado"), t("Ex.: cerâmico, fibrocimento, laje"))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("Equipamentos")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {campoNumero("potencia_modulo_w", t("Potência do módulo (W)"))}
              {campoNumero("area_modulo_m2", t("Área de cada módulo (m²)"))}
              {campoTexto("marca_modulo", t("Marca/modelo do módulo"))}
              {campoTexto("marca_inversor", t("Marca do inversor"))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("Preço e tarifa")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {campoNumero("preco_por_wp", t("Preço do sistema (R$ por Wp)"), t("Equipamentos + instalação + margem."))}
              {campoNumero("tarifa_kwh", t("Tarifa com impostos (R$/kWh)"))}
              {campoNumero(
                "fio_b_kwh",
                t("Fio B da distribuidora (R$/kWh)"),
                t("Componente Fio B da TUSD, na tarifa da distribuidora. A cobrança segue a escada da Lei 14.300: 60% em 2026, 75% em 2027, 90% em 2028."),
              )}
              {campoNumero(
                "simultaneidade_pct",
                t("Consumo simultâneo (%)"),
                t("Parte da geração usada na hora, que não é injetada na rede e não paga Fio B."),
              )}
              {campoNumero("ano_inicio", t("Ano em que o sistema liga"))}
              {campoNumero("reajuste_tarifa_pct_ano", t("Reajuste da tarifa (% ao ano)"))}
              {campoNumero("rendimento_pct", t("Rendimento do sistema (%)"), t("Perdas de calor, cabos e inversor."))}
              {campoNumero("degradacao_pct_ano", t("Perda de rendimento dos módulos (% ao ano)"))}
              {campoNumero("anos_analise", t("Anos da análise"))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("Resultado")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {!resultado ? (
                <p className="text-sm text-muted-foreground">
                  {t("Informe o consumo médio (ou o valor da conta) para ver o dimensionamento.")}
                </p>
              ) : resultado.quantidade_modulos === 0 ? (
                <p role="alert" className="text-sm text-muted-foreground">
                  {t("Com esse consumo não há energia a compensar: ele não passa do custo de disponibilidade da ligação.")}
                </p>
              ) : (
                <>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <Indicador rotulo={t("Potência do sistema")} valor={`${num(resultado.potencia_kwp, 2)} kWp`} destaque />
                    <Indicador rotulo={t("Módulos")} valor={`${resultado.quantidade_modulos} × ${form.potencia_modulo_w} W`} />
                    <Indicador rotulo={t("Inversor sugerido")} valor={`${num(resultado.inversor_kw, resultado.inversor_kw % 1 === 0 ? 0 : 1)} kW`} />
                    <Indicador rotulo={t("Área ocupada")} valor={`${num(resultado.area_m2, 1)} m²`} />
                    <Indicador rotulo={t("Geração mensal")} valor={`${num(resultado.geracao_mensal_kwh)} kWh`} />
                    <Indicador rotulo={t("Cobertura do consumo")} valor={`${num(resultado.cobertura_pct)}%`} />
                    <Indicador rotulo={t("Conta atual")} valor={reais(resultado.conta_atual)} />
                    <Indicador rotulo={t("Economia por mês")} valor={reais(resultado.economia_mensal)} destaque />
                    <Indicador rotulo={t("Investimento")} valor={reais(resultado.investimento)} destaque />
                    <Indicador
                      rotulo={t("Retorno (payback)")}
                      valor={resultado.payback_anos === null ? t("Acima do período") : `${num(resultado.payback_anos, 1)} ${t("anos")}`}
                      destaque
                    />
                    <Indicador
                      rotulo={`${t("Economia em")} ${form.anos_analise} ${t("anos")}`}
                      valor={reais(resultado.economia_total_periodo)}
                    />
                    <Indicador rotulo={t("Retorno sobre o investimento")} valor={`${num(resultado.retorno_pct)}%`} />
                  </dl>

                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      {t("Economia acumulada ano a ano (a linha marca o investimento)")}
                    </p>
                    <div className="h-32 rounded-md border bg-muted/30 p-2">
                      <div className="relative flex h-full items-end gap-0.5">
                        <div
                          aria-hidden
                          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-foreground/50"
                          style={{ bottom: `${(resultado.investimento / maiorAcumulado) * 100}%` }}
                        />
                        {resultado.fluxo.map((f) => (
                          <div
                            key={f.ano}
                            title={`${t("Ano")} ${f.ano}: ${reais(f.acumulado)}`}
                            className={`flex-1 rounded-sm ${f.acumulado >= resultado.investimento ? "bg-primary" : "bg-primary/35"}`}
                            style={{ height: `${Math.max((f.acumulado / maiorAcumulado) * 100, 2)}%` }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {t("Estimativa comercial: não substitui o projeto elétrico nem a análise da distribuidora.")}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {podeCriarProposta ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("Gerar proposta")}</CardTitle>
                <CardDescription>
                  {t("Cria um rascunho com o modelo de energia solar já preenchido. Você revisa e envia pelo editor de propostas.")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {leads.length === 0 ? (
                  <p role="alert" className="text-sm text-muted-foreground">
                    {t("Para criar uma proposta, é necessário ter pelo menos um negócio ativo com um contato vinculado na organização.")}
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="solar-lead">{t("Negócio (Lead)")}</Label>
                    <Select value={leadId} onValueChange={setLeadId}>
                      <SelectTrigger id="solar-lead" className="w-full">
                        <SelectValue placeholder={t("Selecione o negócio...")} />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        {leads.map((lead) => (
                          <SelectItem key={lead.id} value={lead.id}>
                            {lead.title ? `${lead.title} — ` : ""}
                            {rotuloDoContato(lead.contact)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button
                  className="w-full"
                  onClick={gerarProposta}
                  disabled={gerando || !leadId || !resultado || resultado.quantidade_modulos === 0}
                >
                  {gerando ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("Criando proposta…")}
                    </>
                  ) : (
                    t("Gerar proposta")
                  )}
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Indicador({ rotulo, valor, destaque = false }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="rounded-md border p-3">
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className={destaque ? "mt-1 text-lg font-semibold" : "mt-1 font-medium"}>{valor}</dd>
    </div>
  );
}
