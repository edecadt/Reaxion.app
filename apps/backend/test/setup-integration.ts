import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

beforeAll(async () => {
  if (!process.env.DATABASE_URL?.includes('test')) {
    console.warn(
      '⚠️  Warning: DATABASE_URL should contain "test" for integration tests',
    );
  }

  console.log('🔧 Setting up test database...');

  try {
    await execAsync('pnpm prisma db push --accept-data-loss');
  } catch (error) {
    console.error('Failed to setup test database:', error);
    throw error;
  }
}, 30000);
