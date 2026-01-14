# 🔵 AzuCob - Sistema de Cobrança de Inadimplentes

<p align="center">
  <img src="https://azuton.com/wp-content/uploads/2022/01/Group.png" alt="Azuton" width="200"/>
</p>

Sistema moderno de cobrança de clientes inadimplentes, integrando **GestãoClick** e **Efí Bank** para automação do processo de cobrança via email.

## 📋 Funcionalidades

### ✅ Gestão de Clientes
- Sincronização automática com GestãoClick via API
- Base de clientes própria com múltiplos emails de cobrança
- Histórico de cobranças por cliente

### ✅ Regras de Cobrança
- Templates de email personalizáveis (HTML)
- Regras de dias de atraso (D+3, D+7, D+15, D+30)
- Agendamento automático de envios
- Variáveis dinâmicas nos templates (nome, valor, vencimento, etc.)

### ✅ Integração com Efí Bank
- Busca automática de boletos por cliente
- Download de boletos em PDF
- Baixa automática de pagamentos

### ✅ Dashboard Moderno
- Visão geral de inadimplentes
- Filtros por período (última semana, mês)
- Resumo financeiro
- Ações rápidas de cobrança

### ✅ Controle de Baixas
- Baixa manual de pagamentos
- Sincronização com GestãoClick
- Sincronização com Efí Bank

---

## 🏗️ Arquitetura

```
azucob/
├── backend/                 # API Node.js + Express + TypeScript
│   ├── src/
│   │   ├── config/         # Configurações (DB, APIs)
│   │   ├── controllers/    # Controladores REST
│   │   ├── models/         # Modelos Prisma
│   │   ├── routes/         # Rotas da API
│   │   ├── services/       # Lógica de negócio + Integrações
│   │   ├── middlewares/    # Auth, validação
│   │   ├── templates/      # Templates de email HTML
│   │   └── utils/          # Helpers
│   └── prisma/             # Schema do banco
├── frontend/               # React + Vite + TypeScript
│   ├── src/
│   │   ├── components/     # Componentes reutilizáveis
│   │   ├── pages/          # Páginas da aplicação
│   │   ├── hooks/          # Custom hooks
│   │   ├── services/       # Chamadas API
│   │   └── types/          # Tipos TypeScript
│   └── public/             # Assets estáticos
├── docker-compose.yml      # Desenvolvimento local
└── railway.toml            # Deploy Railway
```

---

## 🚀 Deploy na Railway

### 1. Pré-requisitos
- Conta na [Railway](https://railway.app)
- Credenciais da API GestãoClick (Token + Secret)
- Credenciais da API Efí (Client ID + Client Secret + Certificado)
- Conta no [Resend](https://resend.com) para envio de emails

### 2. Variáveis de Ambiente

```env
# Database (Railway fornece automaticamente)
DATABASE_URL=postgresql://...

# Segurança
JWT_SECRET=sua_chave_secreta_aqui
ENCRYPTION_KEY=chave_32_caracteres_para_criptografia

# GestãoClick API
GESTAOCLICK_API_URL=https://api.gestaoclick.com.br/v1
GESTAOCLICK_ACCESS_TOKEN=seu_token
GESTAOCLICK_SECRET_ACCESS=seu_secret

# Efí Bank API
EFI_CLIENT_ID=seu_client_id
EFI_CLIENT_SECRET=seu_client_secret
EFI_CERTIFICATE_PATH=./certs/efi_cert.p12
EFI_SANDBOX=false

# Resend Email API
RESEND_API_KEY=re_xxxxxxxxxxxx
RESEND_FROM_NAME=AzuCob
RESEND_FROM_EMAIL=cobranca@azuton.com

# Frontend
VITE_API_URL=https://seu-backend.railway.app
```

### 3. Deploy

```bash
# Instalar CLI Railway
npm install -g @railway/cli

# Login
railway login

# Criar projeto
railway init

# Adicionar PostgreSQL
railway add postgresql

# Deploy
railway up
```

---

## 🐳 Deploy com Docker

### Opção 1: Desenvolvimento Local

```bash
# Clonar e configurar
git clone <repo>
cd azucob

# Iniciar com Docker Compose (desenvolvimento)
docker-compose up -d

# Ver logs
docker-compose logs -f

# Parar serviços
docker-compose down
```

Acesse:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

### Opção 2: Produção com Docker

```bash
# Copiar e configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas credenciais reais

# Colocar certificado Efí na pasta certs/
mkdir -p certs
cp /caminho/do/certificado.p12 certs/producao.p12

# Build e iniciar em produção
docker-compose -f docker-compose.prod.yml up -d --build

# Ver status
docker-compose -f docker-compose.prod.yml ps

# Ver logs
docker-compose -f docker-compose.prod.yml logs -f
```

Acesse: http://localhost (porta 80)

### Popular Banco de Dados (Seed)

```bash
# No container backend
docker exec -it azucob-backend npm run prisma:seed

# Ou localmente
cd backend
npm run prisma:seed
```

**Credenciais padrão após seed:**
- Email: `admin@azuton.com`
- Senha: `admin123`

⚠️ **Importante:** Altere a senha após o primeiro login!

---

## 💻 Desenvolvimento Local (Sem Docker)

### Requisitos
- Node.js 20+
- PostgreSQL 15+
- pnpm (recomendado)

### Instalação

```bash
# Backend
cd backend
pnpm install
cp .env.example .env
# Editar .env com suas credenciais
pnpm prisma generate
pnpm prisma db push
pnpm dev

# Frontend (nova janela)
cd frontend
pnpm install
cp .env.example .env
pnpm dev
```

### Acessos
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- API Docs: http://localhost:3000/api-docs

---

## 📚 APIs Integradas

### GestãoClick
- **Documentação**: https://gestaoclick.docs.apiary.io/
- **Endpoints utilizados**:
  - `GET /clientes` - Listar clientes
  - `GET /contas_receber` - Contas a receber (inadimplentes)
  - `PUT /contas_receber/{id}` - Baixa de pagamento
  - `GET /faturas/{id}/pdf` - Download de fatura PDF

### Efí Bank
- **Documentação**: https://dev.efipay.com.br/
- **Endpoints utilizados**:
  - `POST /v1/authorize` - Autenticação OAuth2
  - `GET /v1/charge` - Listar cobranças
  - `GET /v1/charge/:id` - Detalhes da cobrança
  - `PUT /v1/charge/:id/settle` - Baixa manual
  - `GET /v1/charge/:id/pdf` - Download boleto PDF

---

## 🎨 Paleta de Cores (Azuton)

```css
:root {
  --azuton-primary: #0066CC;      /* Azul principal */
  --azuton-secondary: #004C99;    /* Azul escuro */
  --azuton-accent: #00AAFF;       /* Azul claro/destaque */
  --azuton-dark: #1A1A2E;         /* Fundo escuro */
  --azuton-light: #F5F7FA;        /* Fundo claro */
  --azuton-success: #00C853;      /* Verde sucesso */
  --azuton-warning: #FFB300;      /* Amarelo alerta */
  --azuton-danger: #FF3D00;       /* Vermelho erro */
}
```

---

## 🔐 Segurança

- Autenticação JWT com refresh tokens
- Credenciais de APIs criptografadas (AES-256)
- Rate limiting nas rotas
- Logs de auditoria
- HTTPS obrigatório em produção

---

## 📄 Licença

Uso interno - Azuton Tecnologia © 2026
