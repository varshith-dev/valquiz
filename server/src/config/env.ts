import iovalkey from 'iovalkey';
import { ValkeyMock } from './ValkeyMock.js';

const Redis = (iovalkey as any).default || (iovalkey as any).Redis || iovalkey;

// All secrets loaded from environment variables.
// Copy .env.example to .env and fill in values before running.
export const env = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  VALKEY_URL: process.env.VALKEY_URL || 'redis://localhost:6379',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  BREETH_API_KEY: process.env.BREETH_API_KEY || '',
  OQENS_API_KEY: process.env.OQENS_API_KEY || '',
  OQENS_CLOUD_ID: process.env.OQENS_CLOUD_ID || '',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
};

let valkeyClient: any = null;

export async function getValkey(): Promise<any> {
  if (valkeyClient) return valkeyClient;

  // Try real Valkey/Redis first
  try {
    valkeyClient = new Redis(env.VALKEY_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
    });
    valkeyClient.on('error', () => {}); // suppress connection errors
    await valkeyClient.connect();
    await valkeyClient.ping();
    console.log('✅ Connected to Valkey/Redis');
    return valkeyClient;
  } catch (err) {
    console.log('⚠️ Valkey/Redis not available, using in-memory mock');
    console.log('   → Install Valkey via: docker run -d -p 6379:6379 valkey/valkey:8.0-alpine');
    try { await (valkeyClient as any)?.quit?.(); } catch {}
  }

  // Fallback to in-memory mock
  valkeyClient = new ValkeyMock();
  await valkeyClient.connect();
  return valkeyClient;
}

export async function closeValkey(): Promise<void> {
  if (valkeyClient) {
    try { await valkeyClient.quit(); } catch {}
    valkeyClient = null;
  }
}
