import { Pool } from 'pg';
import { config } from '../config';

class DatabaseService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: config.database.url,
      ssl: {
        rejectUnauthorized: false, // Required for Supabase
      },
    });

    console.log('✅ Database connection pool initialized');
  }

  /**
   * Test database connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const result = await this.pool.query('SELECT NOW()');
      console.log('✅ Database connected:', result.rows[0].now);
      return true;
    } catch (error: any) {
      console.error('❌ Database connection failed:', error.message);
      return false;
    }
  }

  /**
   * Get database pool for custom queries
   */
  getPool(): Pool {
    return this.pool;
  }

  /**
   * Close all connections (for graceful shutdown)
   */
  async close(): Promise<void> {
    await this.pool.end();
    console.log('✅ Database connections closed');
  }
}

export default new DatabaseService();
