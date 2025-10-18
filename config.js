module.exports = {
  // Supabase Configuration
  supabase: {
    // Correct connection string: postgresql://postgres.eyjtbudtwfzkxypnixsg:tG#esRKbVA6m-7p@aws-1-us-east-2.pooler.supabase.com:6543/postgres
    host: 'aws-1-us-east-2.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: 'postgres.eyjtbudtwfzkxypnixsg',
    password: 'tG#esRKbVA6m-7p',
    ssl: { 
      rejectUnauthorized: false,
      require: true
    },
    // Connection timeout settings
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    // Pool settings
    max: 10, // Reduced from 20 to be more conservative
    min: 2,  // Keep minimum connections alive
    // Additional connection options
    keepAlive: true,
    keepAliveInitialDelayMillis: 0,
    // Retry settings
    retryDelayMs: 1000,
    retryAttempts: 3
  },
  
  // Server Configuration
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development'
  },
  
  // External API Configuration
  certifiedApi: {
    url: 'https://certified-new.learntube.ai/new_entry_test_v2',
    cpo: 'aHR0cHM6Ly9jZXJ0aWZpZWQubGVhcm50dWJlLmFp'
  }
};
