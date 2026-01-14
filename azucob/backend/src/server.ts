import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cron from 'node-cron';
import { config } from './config/env.js';
import { connectDatabase } from './config/database.js';
import { logger } from './utils/logger.js';
import routes from './routes/index.js';
import { syncService } from './services/syncService.js';
import { chargeService } from './services/chargeService.js';
import { gestaoClickService } from './services/gestaoClickService.js';

const app = express();

// ============================================
// ROTA DE TESTE - ANTES DE TUDO
// ============================================
app.get('/api/health/gc', async (req, res) => {
  try {
    const clients = await gestaoClickService.getClients(1, 2);
    res.json({
      campos: clients.length > 0 ? Object.keys(clients[0]) : [],
      primeiroCliente: clients[0] || null,
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// ============================================
// MIDDLEWARES
// ============================================

// Segurança
app.use(helmet());

// CORS - Permitir múltiplas origens
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://gregarious-harmony-production.up.railway.app',
  config.frontend.url,
].filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Muitas requisições. Tente novamente em alguns minutos.' },
});
app.use('/api', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// ============================================
// ROTAS
// ============================================

app.use('/api', routes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// ============================================
// CRON JOBS
// ============================================

function setupCronJobs() {
  cron.schedule(config.cron.syncGestaoClick, async () => {
    logger.info('Iniciando sincronização agendada com GestãoClick...');
    try {
      await syncService.syncClients();
      await syncService.syncReceivables();
    } catch (error) {
      logger.error('Erro na sincronização agendada:', error);
    }
  });

  cron.schedule(config.cron.syncEfi, async () => {
    logger.info('Iniciando sincronização agendada com Efí...');
    try {
      await syncService.syncEfiBoletos();
    } catch (error) {
      logger.error('Erro na sincronização Efí:', error);
    }
  });

  cron.schedule(config.cron.sendCharges, async () => {
    logger.info('Iniciando processamento agendado de cobranças...');
    try {
      await chargeService.processAutomaticCharges();
    } catch (error) {
      logger.error('Erro no processamento de cobranças:', error);
    }
  });

  logger.info('Cron jobs configurados com sucesso');
}

// ============================================
// INICIALIZAÇÃO
// ============================================

async function start() {
  try {
    await connectDatabase();

    if (config.env === 'production') {
      setupCronJobs();
    }

    app.listen(config.port, () => {
      logger.info(`🚀 AzuCob API running on port ${config.port}`);
      logger.info(`📡 Environment: ${config.env}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

start();
```

Commit, aguarde o deploy terminar (veja nos logs se compilou sem erro) e acesse:
```
https://azucob-production.up.railway.app/api/health/gc
