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

const app = express();

// ============================================
// MIDDLEWARES
// ============================================

// Segurança
app.use(helmet());

// CORS
app.use(
  cors({
    origin: config.frontend.url,
    credentials: true,
  })
);

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Máximo 100 requests por IP
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
  // Sincronização com GestãoClick (diariamente às 6h)
  cron.schedule(config.cron.syncGestaoClick, async () => {
    logger.info('Iniciando sincronização agendada com GestãoClick...');
    try {
      await syncService.syncClients();
      await syncService.syncReceivables();
    } catch (error) {
      logger.error('Erro na sincronização agendada:', error);
    }
  });

  // Sincronização com Efí (a cada 4 horas)
  cron.schedule(config.cron.syncEfi, async () => {
    logger.info('Iniciando sincronização agendada com Efí...');
    try {
      await syncService.syncEfiBoletos();
    } catch (error) {
      logger.error('Erro na sincronização Efí:', error);
    }
  });

  // Processamento de cobranças (segunda a sexta às 9h)
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
    // Conecta ao banco de dados
    await connectDatabase();

    // Configura cron jobs
    if (config.env === 'production') {
      setupCronJobs();
    }

    // Inicia o servidor
    app.listen(config.port, () => {
      logger.info(`🚀 AzuCob API running on port ${config.port}`);
      logger.info(`📡 Environment: ${config.env}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

start();
