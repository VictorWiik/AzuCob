import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@azuton.com' },
    update: {},
    create: {
      name: 'Administrador',
      email: 'admin@azuton.com',
      password: hashedPassword,
      role: 'ADMIN',
    },
  });
  console.log('✅ Admin user created:', adminUser.email);

  // Create default email template
  const defaultTemplate = await prisma.emailTemplate.upsert({
    where: { id: 'default-template' },
    update: {},
    create: {
      id: 'default-template',
      name: 'Template Padrão de Cobrança',
      subject: 'Aviso de Cobrança - {{nome}} - {{valor}}',
      htmlContent: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #0066CC, #004C99); color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; }
    .header p { margin: 10px 0 0; opacity: 0.9; }
    .content { padding: 30px 20px; background: #ffffff; }
    .highlight { background: #f8f9fa; padding: 20px; border-left: 4px solid #0066CC; margin: 20px 0; border-radius: 0 8px 8px 0; }
    .highlight p { margin: 8px 0; }
    .highlight strong { color: #0066CC; }
    .amount { font-size: 24px; color: #FF3D00; font-weight: bold; }
    .footer { background: #1A1A2E; color: #ffffff; padding: 20px; text-align: center; font-size: 12px; }
    .footer a { color: #00AAFF; text-decoration: none; }
    .btn { display: inline-block; background: #0066CC; color: white !important; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
    .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 8px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔔 Aviso de Cobrança</h1>
      <p>Azuton Tecnologia em Telecomunicações</p>
    </div>
    
    <div class="content">
      <p>Prezado(a) <strong>{{nome}}</strong>,</p>
      
      <p>Identificamos que existe uma pendência financeira em aberto referente ao seu cadastro:</p>
      
      <div class="highlight">
        <p><strong>📋 Descrição:</strong> {{descricao}}</p>
        <p><strong>💰 Valor:</strong> <span class="amount">{{valor}}</span></p>
        <p><strong>📅 Vencimento:</strong> {{vencimento}}</p>
        <p><strong>⏰ Dias em atraso:</strong> {{dias_atraso}} dias</p>
      </div>
      
      <div class="warning">
        <strong>⚠️ Importante:</strong> A regularização do débito é necessária para evitar a suspensão dos serviços contratados.
      </div>
      
      <p>Para sua comodidade, anexamos:</p>
      <ul>
        <li>📄 Boleto bancário para pagamento</li>
        <li>📋 Fatura detalhada dos serviços</li>
      </ul>
      
      <p>Caso já tenha efetuado o pagamento, por favor desconsidere esta mensagem. O prazo para compensação bancária é de até 3 dias úteis.</p>
      
      <p>Em caso de dúvidas, entre em contato com nossa equipe financeira.</p>
      
      <p>Atenciosamente,<br>
      <strong>Equipe Financeira - Azuton</strong></p>
    </div>
    
    <div class="footer">
      <p><strong>Azuton Tecnologia em Telecomunicações</strong></p>
      <p>📧 financeiro@azuton.com | 📞 (00) 0000-0000</p>
      <p><a href="https://www.azuton.com">www.azuton.com</a></p>
    </div>
  </div>
</body>
</html>`,
      isActive: true,
    },
  });
  console.log('✅ Default template created:', defaultTemplate.name);

  // Create second template (more urgent)
  const urgentTemplate = await prisma.emailTemplate.upsert({
    where: { id: 'urgent-template' },
    update: {},
    create: {
      id: 'urgent-template',
      name: 'Template Urgente - Último Aviso',
      subject: '🚨 ÚLTIMO AVISO - Pendência Financeira - {{nome}}',
      htmlContent: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #FF3D00, #D32F2F); color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; }
    .content { padding: 30px 20px; background: #ffffff; }
    .highlight { background: #ffebee; padding: 20px; border-left: 4px solid #FF3D00; margin: 20px 0; border-radius: 0 8px 8px 0; }
    .amount { font-size: 28px; color: #FF3D00; font-weight: bold; }
    .footer { background: #1A1A2E; color: #ffffff; padding: 20px; text-align: center; font-size: 12px; }
    .footer a { color: #00AAFF; text-decoration: none; }
    .urgent-box { background: #FF3D00; color: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚨 ÚLTIMO AVISO</h1>
      <p>Regularize sua situação imediatamente</p>
    </div>
    
    <div class="content">
      <p>Prezado(a) <strong>{{nome}}</strong>,</p>
      
      <div class="urgent-box">
        <h2 style="margin: 0;">ATENÇÃO!</h2>
        <p style="margin: 10px 0 0;">Este é o último aviso antes da suspensão dos serviços.</p>
      </div>
      
      <p>Apesar das tentativas anteriores de contato, identificamos que a pendência financeira abaixo continua em aberto:</p>
      
      <div class="highlight">
        <p><strong>📋 Descrição:</strong> {{descricao}}</p>
        <p><strong>💰 Valor:</strong> <span class="amount">{{valor}}</span></p>
        <p><strong>📅 Vencimento Original:</strong> {{vencimento}}</p>
        <p><strong>⏰ Dias em atraso:</strong> <strong style="color: #FF3D00;">{{dias_atraso}} dias</strong></p>
      </div>
      
      <p><strong>⚠️ Importante:</strong> Caso o pagamento não seja identificado nos próximos 48 horas, os serviços serão suspensos automaticamente.</p>
      
      <p>Em anexo seguem o boleto atualizado e a fatura para regularização imediata.</p>
      
      <p>Atenciosamente,<br>
      <strong>Equipe Financeira - Azuton</strong></p>
    </div>
    
    <div class="footer">
      <p><strong>Azuton Tecnologia em Telecomunicações</strong></p>
      <p>📧 financeiro@azuton.com</p>
      <p><a href="https://www.azuton.com">www.azuton.com</a></p>
    </div>
  </div>
</body>
</html>`,
      isActive: true,
    },
  });
  console.log('✅ Urgent template created:', urgentTemplate.name);

  // Create default charge rules
  const rules = [
    { id: 'rule-d3', name: 'Cobrança D+3', daysOverdue: 3, templateId: 'default-template' },
    { id: 'rule-d7', name: 'Cobrança D+7', daysOverdue: 7, templateId: 'default-template' },
    { id: 'rule-d15', name: 'Cobrança D+15', daysOverdue: 15, templateId: 'default-template' },
    { id: 'rule-d30', name: 'Último Aviso D+30', daysOverdue: 30, templateId: 'urgent-template' },
  ];

  for (const rule of rules) {
    const created = await prisma.chargeRule.upsert({
      where: { id: rule.id },
      update: {},
      create: {
        id: rule.id,
        name: rule.name,
        daysOverdue: rule.daysOverdue,
        templateId: rule.templateId,
        isActive: true,
        sendBoleto: true,
        sendInvoice: true,
      },
    });
    console.log(`✅ Rule created: ${created.name} (D+${created.daysOverdue})`);
  }

  console.log('\n🎉 Database seeding completed!');
  console.log('\n📝 Login credentials:');
  console.log('   Email: admin@azuton.com');
  console.log('   Password: admin123');
  console.log('\n⚠️  Remember to change the password after first login!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
