#!/usr/bin/env bash
# atualizar-pacote.sh — atualiza o CRM SEM GitHub, só com o servidor.
#
# Modo de operação da IPSOLAR: o código mora neste servidor (e numa cópia no PC
# do dono), e as imagens do app, do worker e do scheduler são MONTADAS AQUI, não
# baixadas de registro nenhum. Cada leva de mudanças chega como um arquivo
# `.patch`, enviado para o servidor e aplicado por este script.
#
#   bash hostgator-setup-kit/atualizar-pacote.sh                      # só monta aqui o código atual
#   bash hostgator-setup-kit/atualizar-pacote.sh /root/mudanca.patch  # aplica a mudança e monta
#
# Quem faz a atualização de verdade (backup, banco, troca de versão, conferência
# de saúde e volta automática se der errado) continua sendo o update.sh — este
# script só prepara o código e pede a ele a construção local.
set -euo pipefail

KIT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$KIT_DIR/.."
export GIT_TERMINAL_PROMPT=0

verde() { printf '\033[32m%s\033[0m\n' "$*"; }
amarelo() { printf '\033[33m%s\033[0m\n' "$*"; }
erro() { printf '\033[31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

PATCH="${1:-}"
if [ -n "$PATCH" ]; then
  [ -f "$PATCH" ] || erro "Não achei o arquivo $PATCH. Confira o nome e o caminho (ex.: /root/mudanca.patch)."
  PATCH="$(cd "$(dirname "$PATCH")" && pwd)/$(basename "$PATCH")"
fi

# ── 1. Memória de reserva ────────────────────────────────────────────────────
# Montar o app pede uns 4 GB só para ele, com o CRM inteiro no ar ao lado. Um
# arquivo de troca de 4 GB evita que o servidor fique sem memória no meio.
if [ -z "$(swapon --show --noheadings 2>/dev/null)" ]; then
  amarelo "Criando 4 GB de memória de reserva (swap) — só na primeira vez…"
  if [ ! -f /swapfile ]; then
    fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096 status=none
    chmod 600 /swapfile
    mkswap /swapfile >/dev/null
  fi
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  verde "✓ memória de reserva ligada"
fi

# ── 2. Código ────────────────────────────────────────────────────────────────
# Sem GitHub: o remoto sai, para nenhum comando ficar esperando por ele.
if git remote get-url origin >/dev/null 2>&1; then
  git remote remove origin
  amarelo "Desliguei o GitHub deste servidor — daqui para frente o código mora aqui."
fi

git diff --quiet HEAD -- || erro "Há arquivos do CRM alterados à mão neste servidor (veja com: git status). Nada foi mexido."

if git show-ref --verify --quiet refs/heads/ipsolar; then
  git checkout --quiet ipsolar
else
  git checkout --quiet -b ipsolar
fi

if [ -n "$PATCH" ]; then
  if ! git -c user.name="IPSOLAR" -c user.email="crm@ipsolar.local" am --3way --quiet "$PATCH"; then
    git am --abort >/dev/null 2>&1 || true
    erro "A mudança não encaixou no código deste servidor. Nada foi alterado — mande este erro para o Claude."
  fi
  verde "✓ mudança aplicada: $(git log -1 --format=%s)"
fi

VERSAO="$(sed -nE 's/^ *"version": *"([^"]+)".*/\1/p' package.json | head -1)"
TAG="v${VERSAO:-0.1.0}-ipsolar.$(date +%Y%m%d%H%M%S)"
git tag "$TAG"
verde "✓ versão $TAG"

# ── 3. Montar aqui e subir ───────────────────────────────────────────────────
amarelo "Montando o CRM neste servidor. Leva de 15 a 25 minutos — pode deixar rodando."
amarelo "(No meio, uma mensagem fala de \"arquitetura\": é esperado, não é erro.)"
DESKCOMM_BUILD_LOCAL=1 bash "$KIT_DIR/update.sh" --to "$TAG" --force

# ── 4. Cópia do código para o PC ─────────────────────────────────────────────
COPIA="$HOME/ipsolar-crm-codigo.tar.gz"
git archive --format=tar.gz -o "$COPIA" HEAD
verde "✓ cópia do código atualizada em $COPIA"
amarelo "Para guardar no seu PC, no PowerShell do Windows:"
amarelo "  scp root@IP_DO_SERVIDOR:$COPIA ."
