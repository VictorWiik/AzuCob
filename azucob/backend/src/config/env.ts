import dotenv from 'dotenv';

dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  
  jwt: {
    secret: process.env.JWT_SECRET || 'default_secret_change_in_production',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  },
  
  encryption: {
    key: process.env.ENCRYPTION_KEY || 'default_encryption_key_32chars!',
  },
  
  gestaoClick: {
    apiUrl: process.env.GESTAOCLICK_API_URL || 'https://api.gestaoclick.com.br/v1',
    accessToken: process.env.GESTAOCLICK_ACCESS_TOKEN || '',
    secretAccess: process.env.GESTAOCLICK_SECRET_ACCESS || '',
  },
  
  efi: {
    clientId: process.env.EFI_CLIENT_ID || '',
    clientSecret: process.env.EFI_CLIENT_SECRET || '',
    sandbox: process.env.EFI_SANDBOX === 'true',
    apiUrl: process.env.EFI_API_URL || 'https://apis-h.efipay.com.br',
    certificatePath: process.env.EFI_CERTIFICATE_PATH || '',
  },
  
  resend: {
    apiKey: process.env.RESEND_API_KEY || '',
    fromName: process.env.RESEND_FROM_NAME || 'AzuCob',
    fromEmail: process.env.RESEND_FROM_EMAIL || 'cobranca@azuton.com',
  },
  
  frontend: {
    url: process.env.FRONTEND_URL || 'http://localhost:5173',
  },
  
  cron: {
    syncGestaoClick: process.env.SYNC_GESTAOCLICK_CRON || '0 6 * * *',
    syncEfi: process.env.SYNC_EFI_CRON || '0 */4 * * *',
    sendCharges: process.env.SEND_CHARGES_CRON || '0 9 * * 1-5',
  },
};
