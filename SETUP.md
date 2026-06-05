# Hair Day — Guia de configuração (Fases 0 e 1)

Sistema de agendamento de barbearia. Front-end (webpack) + API serverless (Vercel) + banco/auth (Supabase).

## Arquitetura atual

```
Navegador (front-end em /src, buildado para /dist)
        │  fetch  →  /api/appointments
        ▼
Vercel Serverless Functions (/api/*.js)  ──►  Supabase (Postgres)
```

## ✅ O que já está pronto

- Estrutura de produção para deploy na Vercel (`vercel.json`)
- URL da API por variável de ambiente (sem `localhost` fixo)
- Schema do banco: `supabase/schema.sql`
- API de agendamentos:
  - `GET  /api/appointments?date=YYYY-MM-DD` — lista do dia
  - `POST /api/appointments` — cria cliente (nome, e-mail, telefone) + agendamento
  - `DELETE /api/appointments/:id` — cancela
- Conflito de horário bloqueado **no banco** (índice único), não só no front
- Formulário com **nome completo, e-mail e telefone** + validação (front e back)
- **E-mail automático** (Resend) de **confirmação** (no agendamento) e
  **cancelamento**, cada um com **convite `.ics`** anexado para o calendário
  (Google/Apple/Outlook). Horário exibido no fuso da barbearia.

## 🔧 Passos para colocar no ar

### 1. Criar o projeto no Supabase
1. Crie uma conta em https://supabase.com e um novo projeto.
2. Em **SQL Editor → New query**, cole o conteúdo de `supabase/schema.sql` e clique em **Run**.
3. Em **Project Settings → API**, copie:
   - `Project URL` → vira `SUPABASE_URL`
   - `service_role` secret → vira `SUPABASE_SERVICE_ROLE_KEY`

### 2. Variáveis de ambiente
Copie `.env.example` para `.env` e preencha (local). Na Vercel, cadastre as
mesmas em **Project Settings → Environment Variables**:

| Variável | Onde usar | Valor |
|---|---|---|
| `SUPABASE_URL` | Functions | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Functions | chave service_role (secreta) |
| `SUPABASE_ANON_KEY` | Build (front) + Functions | chave anon (pública) p/ login |
| `ADMIN_EMAILS` | Functions | e-mails admin, separados por vírgula |
| `API_BASE_URL` | Build (front) | `/api` em produção |
| `RESEND_API_KEY` | Functions | chave do Resend (e-mails) |
| `MAIL_FROM` | Functions | remetente verificado, ex: `Hair Day <agenda@seudominio.com>` |
| `MAIL_REPLY_TO` *(opcional)* | Functions | e-mail organizador do convite |
| `SHOP_NAME` *(opcional)* | Functions | nome exibido nos e-mails |
| `BARBERSHOP_TZ` *(opcional)* | Functions | fuso, padrão `America/Sao_Paulo` |

> ⚠️ `SUPABASE_URL` e `SUPABASE_ANON_KEY` também precisam estar definidas **no
> momento do build** (são injetadas no front pelo webpack). Na Vercel, basta
> cadastrá-las nas Environment Variables que o build as utiliza.

> Sem `RESEND_API_KEY`/`MAIL_FROM` o sistema **continua funcionando** — apenas
> não envia e-mails (registra um aviso no log). Assim você pode testar o
> agendamento antes de configurar o Resend.

### 3. Deploy na Vercel
1. Importe o repositório em https://vercel.com.
2. A Vercel lê o `vercel.json` (build `npm run build`, saída `dist`, functions em `/api`).
3. Cadastre as variáveis de ambiente do passo 2.
4. Deploy.

### 4. Rodar localmente (full-stack)
```bash
npm install
npm i -g vercel        # uma vez
vercel dev             # sobe front + /api juntos em http://localhost:3000
```
> `npm run dev` (webpack) sobe **só o front**, sem a API.

### 5. Configurar o Resend (e-mails)
1. Crie uma conta em https://resend.com.
2. **Verifique um domínio** de envio (Domains → Add Domain) e configure os
   registros DNS indicados. Sem domínio verificado, só dá para enviar para o
   seu próprio e-mail (modo teste).
3. Gere uma **API key** (API Keys) → `RESEND_API_KEY`.
4. Defina `MAIL_FROM` com um remetente do domínio verificado.

### 6. Autenticação (Supabase Auth)
1. Em **Project Settings → API**, copie a chave `anon public` → `SUPABASE_ANON_KEY`.
2. Defina `ADMIN_EMAILS` com o(s) e-mail(s) da barbearia (ex: `dono@barbearia.com`).
3. Crie o usuário admin: **Authentication → Users → Add user**, com o mesmo
   e-mail do `ADMIN_EMAILS` e uma senha. Marque para confirmar o e-mail.
4. (Recomendado) Em **Authentication → Providers → Email**, ajuste se quer ou
   não exigir confirmação de e-mail para novos cadastros (relevante na Fase 3b).

### 7. (Opcional) WhatsApp via Z-API
O sistema funciona **sem** WhatsApp; configure quando quiser ativá-lo.
1. Crie a conta em https://z-api.io e uma **instância**; conecte seu número
   lendo o **QR code** pelo WhatsApp (Aparelhos conectados).
2. Copie da instância: `ZAPI_INSTANCE_ID` e `ZAPI_INSTANCE_TOKEN`.
3. Em **Segurança**, copie o *Account Security Token* → `ZAPI_CLIENT_TOKEN`.
4. (Opcional) Ajuste `WHATSAPP_COUNTRY_CODE` (padrão `55`).

> Sem essas variáveis, os envios de WhatsApp são apenas ignorados (com aviso no
> log) — confirmação/cancelamento/reagendamento continuam indo por e-mail.
> Obs.: a Z-API é não-oficial; use um número dedicado para reduzir risco.

## 🗺️ Páginas

| Rota | Quem | Função |
|---|---|---|
| `/` (`index.html`) | Público | Agendar + ver disponibilidade (sem nomes) |
| `/login.html` | Todos | Login e cadastro (e-mail + senha) |
| `/admin.html` | Admin | Painel: ver/cancelar/remarcar todos os agendamentos |
| `/minha-conta.html` | Cliente | Ver/cancelar/remarcar os próprios agendamentos |

> O vínculo entre conta e agendamentos é pelo **e-mail**: o cliente vê os
> agendamentos feitos com o mesmo e-mail do login (mesmo os criados antes de
> ele ter conta).

## 🔜 Próximas fases (combinadas)

- **Fase 2** ✅ — E-mail (Resend) de confirmação/cancelamento + convite `.ics`.
- **Fase 3a** ✅ — Login (e-mail+senha) + painel admin (ver/cancelar/remarcar) +
  ocultação dos nomes na página pública. Reagendamento por e-mail acionado.
- **Fase 3b** ✅ — Área do cliente (`/minha-conta.html`): cadastro, ver/reagendar/
  cancelar os próprios agendamentos (dono autorizado no back-end por e-mail).
- **Fase 4** ✅ (código) — WhatsApp via Z-API (confirmação/cancelamento/reagendamento),
  best-effort. Falta só você criar a conta Z-API e preencher as variáveis.
