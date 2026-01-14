# 📚 AzuCob API Documentation

Base URL: `http://localhost:3000/api`

## 🔐 Autenticação

Todas as rotas (exceto `/auth/login` e `/auth/register`) requerem autenticação via JWT.

Inclua o token no header:
```
Authorization: Bearer <seu_token_jwt>
```

---

## 📋 Endpoints

### Auth

| Método | Endpoint | Descrição | Auth |
|--------|----------|-----------|------|
| POST | `/auth/login` | Login do usuário | ❌ |
| POST | `/auth/register` | Registrar novo usuário | ❌ |
| GET | `/auth/me` | Dados do usuário logado | ✅ |

#### POST /auth/login
```json
// Request
{
  "email": "admin@azuton.com",
  "password": "admin123"
}

// Response 200
{
  "user": {
    "id": "uuid",
    "name": "Administrador",
    "email": "admin@azuton.com",
    "role": "ADMIN"
  },
  "token": "eyJhbGciOiJIUzI1..."
}
```

---

### Dashboard

| Método | Endpoint | Descrição | Auth |
|--------|----------|-----------|------|
| GET | `/dashboard/summary` | Resumo financeiro | ✅ |
| GET | `/dashboard/top-debtors` | Top devedores | ✅ |
| GET | `/dashboard/recent-charges` | Cobranças recentes | ✅ |
| GET | `/dashboard/integration-status` | Status das integrações | ✅ |

#### GET /dashboard/summary
```json
// Response 200
{
  "totalOverdue": 150000.50,
  "totalReceivables": 45,
  "overdueReceivables": 12,
  "averageDaysOverdue": 15,
  "chargesSentToday": 5,
  "chargesSentWeek": 23
}
```

---

### Clientes

| Método | Endpoint | Descrição | Auth |
|--------|----------|-----------|------|
| GET | `/clients` | Listar todos os clientes | ✅ |
| GET | `/clients/overdue` | Clientes inadimplentes | ✅ |
| GET | `/clients/:id` | Detalhes do cliente | ✅ |
| POST | `/clients/:id/emails` | Adicionar email de cobrança | ✅ |
| DELETE | `/clients/:id/emails/:emailId` | Remover email | ✅ |

#### GET /clients
Query params:
- `page`: Página (default: 1)
- `limit`: Itens por página (default: 20)
- `search`: Busca por nome/documento
- `status`: `ACTIVE` | `INACTIVE`

```json
// Response 200
{
  "data": [
    {
      "id": "uuid",
      "externalId": "123",
      "name": "Cliente Exemplo",
      "document": "12.345.678/0001-90",
      "primaryEmail": "cliente@email.com",
      "additionalEmails": ["financeiro@email.com"],
      "phone": "(11) 99999-9999",
      "status": "ACTIVE",
      "overdueCount": 2,
      "totalOverdue": 5000.00
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

#### POST /clients/:id/emails
```json
// Request
{
  "email": "novo-email@empresa.com"
}

// Response 200
{
  "message": "Email adicionado com sucesso",
  "additionalEmails": ["financeiro@email.com", "novo-email@empresa.com"]
}
```

---

### Contas a Receber (Receivables)

| Método | Endpoint | Descrição | Auth |
|--------|----------|-----------|------|
| GET | `/receivables` | Listar contas | ✅ |
| GET | `/receivables/overdue` | Contas vencidas | ✅ |
| GET | `/receivables/:id` | Detalhes da conta | ✅ |
| POST | `/receivables/:id/settle` | Dar baixa na conta | ✅ |
| POST | `/receivables/:id/charge` | Enviar cobrança manual | ✅ |

#### GET /receivables
Query params:
- `page`, `limit`: Paginação
- `status`: `PENDING` | `OVERDUE` | `PAID` | `CANCELLED`
- `clientId`: Filtrar por cliente
- `dueDateFrom`, `dueDateTo`: Filtro de vencimento
- `minDaysOverdue`, `maxDaysOverdue`: Dias de atraso

```json
// Response 200
{
  "data": [
    {
      "id": "uuid",
      "externalId": "456",
      "clientId": "uuid",
      "client": { "name": "Cliente", "document": "..." },
      "description": "Mensalidade Janeiro/2026",
      "amount": 1500.00,
      "dueDate": "2026-01-10",
      "status": "OVERDUE",
      "daysOverdue": 3,
      "lastChargeDate": "2026-01-13T09:00:00Z",
      "chargeCount": 1,
      "boletoUrl": "https://...",
      "boletoNumber": "12345"
    }
  ],
  "pagination": { ... }
}
```

#### POST /receivables/:id/settle
```json
// Request
{
  "paymentDate": "2026-01-13",
  "paymentAmount": 1500.00,
  "syncGestaoClick": true,
  "syncEfi": true
}

// Response 200
{
  "message": "Pagamento registrado com sucesso",
  "receivable": { ... },
  "gestaoClickSync": { "success": true },
  "efiSync": { "success": true }
}
```

#### POST /receivables/:id/charge
```json
// Request
{
  "templateId": "uuid",      // opcional, usa template da regra
  "sendBoleto": true,
  "sendInvoice": true
}

// Response 200
{
  "message": "Cobrança enviada com sucesso",
  "emailsSent": ["cliente@email.com", "financeiro@email.com"],
  "attachments": ["boleto.pdf", "fatura.pdf"]
}
```

---

### Templates de Email

| Método | Endpoint | Descrição | Auth |
|--------|----------|-----------|------|
| GET | `/templates` | Listar templates | ✅ |
| GET | `/templates/variables` | Variáveis disponíveis | ✅ |
| GET | `/templates/:id` | Detalhes do template | ✅ |
| POST | `/templates` | Criar template | ✅ |
| PUT | `/templates/:id` | Atualizar template | ✅ |
| DELETE | `/templates/:id` | Excluir template | ✅ |

#### GET /templates/variables
```json
// Response 200
{
  "variables": [
    "nome",
    "valor",
    "vencimento",
    "dias_atraso",
    "descricao",
    "documento"
  ]
}
```

#### POST /templates
```json
// Request
{
  "name": "Template Urgente",
  "subject": "🚨 URGENTE - Pendência {{nome}}",
  "htmlContent": "<!DOCTYPE html>...",
  "isActive": true
}

// Response 201
{
  "id": "uuid",
  "name": "Template Urgente",
  "subject": "🚨 URGENTE - Pendência {{nome}}",
  "htmlContent": "<!DOCTYPE html>...",
  "isActive": true,
  "createdAt": "2026-01-13T12:00:00Z"
}
```

---

### Regras de Cobrança

| Método | Endpoint | Descrição | Auth |
|--------|----------|-----------|------|
| GET | `/rules` | Listar regras | ✅ |
| GET | `/rules/:id` | Detalhes da regra | ✅ |
| POST | `/rules` | Criar regra | ✅ |
| PUT | `/rules/:id` | Atualizar regra | ✅ |
| DELETE | `/rules/:id` | Excluir regra | ✅ |
| POST | `/rules/:id/toggle` | Ativar/desativar regra | ✅ |

#### POST /rules
```json
// Request
{
  "name": "Cobrança D+7",
  "daysOverdue": 7,
  "templateId": "uuid",
  "isActive": true,
  "sendBoleto": true,
  "sendInvoice": true
}

// Response 201
{
  "id": "uuid",
  "name": "Cobrança D+7",
  "daysOverdue": 7,
  "templateId": "uuid",
  "template": { "name": "Template Padrão", ... },
  "isActive": true,
  "sendBoleto": true,
  "sendInvoice": true
}
```

---

### Sincronização (Admin Only)

| Método | Endpoint | Descrição | Auth | Admin |
|--------|----------|-----------|------|-------|
| POST | `/sync/clients` | Sincronizar clientes | ✅ | ✅ |
| POST | `/sync/receivables` | Sincronizar contas | ✅ | ✅ |
| POST | `/sync/efi` | Sincronizar boletos Efí | ✅ | ✅ |
| POST | `/sync/full` | Sincronização completa | ✅ | ✅ |
| POST | `/charges/process` | Processar cobranças | ✅ | ✅ |

#### POST /sync/full
```json
// Response 200
{
  "message": "Sincronização completa concluída",
  "clients": { "synced": 150, "errors": 0 },
  "receivables": { "synced": 45, "errors": 2 },
  "boletos": { "synced": 30, "errors": 0 }
}
```

---

## ❌ Códigos de Erro

| Código | Descrição |
|--------|-----------|
| 400 | Bad Request - Dados inválidos |
| 401 | Unauthorized - Token inválido ou ausente |
| 403 | Forbidden - Sem permissão |
| 404 | Not Found - Recurso não encontrado |
| 409 | Conflict - Conflito (ex: email duplicado) |
| 422 | Unprocessable Entity - Erro de validação |
| 500 | Internal Server Error - Erro interno |

```json
// Exemplo de erro
{
  "error": "Validation Error",
  "details": [
    { "field": "email", "message": "Email inválido" }
  ]
}
```

---

## 🕐 Rate Limiting

- **Geral**: 100 requests/minuto por IP
- **Auth**: 5 requests/minuto por IP
- **Sync**: 10 requests/hora por usuário

Headers de resposta:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1705150800
```

---

## 📅 Cron Jobs Automáticos

| Schedule | Descrição |
|----------|-----------|
| `0 6 * * *` | Sync GestãoClick (06:00 diário) |
| `0 */4 * * *` | Sync Efí (a cada 4 horas) |
| `0 9 * * 1-5` | Processar cobranças (09:00 seg-sex) |
