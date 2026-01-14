import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middlewares/auth.js';
import { authController } from '../controllers/authController.js';
import { clientController } from '../controllers/clientController.js';
import { receivableController } from '../controllers/receivableController.js';
import { dashboardController } from '../controllers/dashboardController.js';
import { templateController } from '../controllers/templateController.js';
import { ruleController } from '../controllers/ruleController.js';
import { syncService } from '../services/syncService.js';
import { chargeService } from '../services/chargeService.js';
import { gestaoClickService } from '../services/gestaoClickService.js';

const router = Router();

// ============================================
// ROTAS PÚBLICAS (sem autenticação)
// ============================================

router.post('/auth/login', (req, res) => authController.login(req, res));
router.post('/auth/register', (req, res) => authController.register(req, res));

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// ROTAS PROTEGIDAS (requer autenticação)
// ============================================

router.use(authMiddleware);

// Auth
router.get('/auth/me', (req, res) => authController.me(req, res));

// Dashboard
router.get('/dashboard/summary', (req, res) => dashboardController.getSummary(req, res));
router.get('/dashboard/top-debtors', (req, res) => dashboardController.getTopDebtors(req, res));
router.get('/dashboard/recent-charges', (req, res) => dashboardController.getRecentCharges(req, res));
router.get('/dashboard/integration-status', (req, res) => dashboardController.getIntegrationStatus(req, res));

// Clientes
router.get('/clients', (req, res) => clientController.list(req, res));
router.get('/clients/overdue', (req, res) => clientController.listOverdue(req, res));
router.get('/clients/:id', (req, res) => clientController.getById(req, res));
router.post('/clients/:id/emails', (req, res) => clientController.addEmail(req, res));
router.delete('/clients/:id/emails/:emailId', (req, res) => clientController.removeEmail(req, res));

// Contas a Receber
router.get('/receivables', (req, res) => receivableController.list(req, res));
router.get('/receivables/overdue', (req, res) => receivableController.listOverdue(req, res));
router.get('/receivables/:id', (req, res) => receivableController.getById(req, res));
router.post('/receivables/:id/settle', (req, res) => receivableController.settle(req, res));
router.post('/receivables/:id/charge', (req, res) => receivableController.sendCharge(req, res));

// Templates de Email
router.get('/templates', (req, res) => templateController.list(req, res));
router.get('/templates/variables', (req, res) => templateController.getAvailableVariables(req, res));
router.get('/templates/:id', (req, res) => templateController.getById(req, res));
router.post('/templates', (req, res) => templateController.create(req, res));
router.put('/templates/:id', (req, res) => templateController.update(req, res));
router.delete('/templates/:id', (req, res) => templateController.delete(req, res));

// Regras de Cobrança
router.get('/rules', (req, res) => ruleController.list(req, res));
router.get('/rules/:id', (req, res) => ruleController.getById(req, res));
router.post('/rules', (req, res) => ruleController.create(req, res));
router.put('/rules/:id', (req, res) => ruleController.update(req, res));
router.delete('/rules/:id', (req, res) => ruleController.delete(req, res));
router.post('/rules/:id/toggle', (req, res) => ruleController.toggleActive(req, res));

// ============================================
// ROTAS ADMIN (requer permissão de admin)
// ============================================

router.use(adminMiddleware);

// TESTE: Ver dados brutos do GestãoClick
router.get('/test/gestaoclick-raw', async (req, res) => {
  try {
    const clients = await gestaoClickService.getClients(1, 3); // Pega só 3 clientes
    res.json({
      message: 'Dados brutos do GestãoClick',
      totalRetornado: clients.length,
      campos: clients.length > 0 ? Object.keys(clients[0]) : [],
      clientes: clients,
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar dados', details: String(error) });
  }
});

// Sincronização manual
router.post('/sync/clients', async (req, res) => {
  try {
    const result = await syncService.syncClients();
    res.json({ message: 'Sincronização de clientes concluída', result });
  } catch (error) {
    res.status(500).json({ error: 'Erro na sincronização' });
  }
});

router.post('/sync/receivables', async (req, res) => {
  try {
    const result = await syncService.syncReceivables();
    res.json({ message: 'Sincronização de contas concluída', result });
  } catch (error) {
    res.status(500).json({ error: 'Erro na sincronização' });
  }
});

router.post('/sync/efi', async (req, res) => {
  try {
    const result = await syncService.syncEfiBoletos();
    res.json({ message: 'Sincronização de boletos Efí concluída', result });
  } catch (error) {
    res.status(500).json({ error: 'Erro na sincronização' });
  }
});

router.post('/sync/full', async (req, res) => {
  try {
    await syncService.fullSync();
    res.json({ message: 'Sincronização completa concluída' });
  } catch (error) {
    res.status(500).json({ error: 'Erro na sincronização' });
  }
});

// Processar cobranças manualmente
router.post('/charges/process', async (req, res) => {
  try {
    const result = await chargeService.processAutomaticCharges();
    res.json({ message: 'Processamento de cobranças concluído', result });
  } catch (error) {
    res.status(500).json({ error: 'Erro no processamento' });
  }
});

export default router;
```

Commit, aguarde o deploy e depois acesse no navegador:
```
https://azucob-production.up.railway.app/api/test/gestaoclick-raw
