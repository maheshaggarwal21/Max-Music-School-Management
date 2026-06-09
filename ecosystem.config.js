// ecosystem.config.js — PM2 process list
// 5 processes: api:4000 + operator-panel:3000 + 3 institution panels:3001-3003
// Usage: pm2 start ecosystem.config.js --env production

module.exports = {
  apps: [
    {
      name: 'api',
      script: './apps/api/src/server.js',
      watch: false,
      max_memory_restart: '500M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 4000,
      },
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'operator-panel',
      script: 'node_modules/.bin/next',
      args: 'start --port 3000',
      cwd: './apps/operator-panel',
      watch: false,
      max_memory_restart: '400M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: '../../logs/operator-panel-error.log',
      out_file: '../../logs/operator-panel-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'admin-panel',
      script: 'node_modules/.bin/next',
      args: 'start --port 3001',
      cwd: './apps/institution-admin-panel',
      watch: false,
      max_memory_restart: '400M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      error_file: '../../logs/admin-panel-error.log',
      out_file: '../../logs/admin-panel-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'teacher-panel',
      script: 'node_modules/.bin/next',
      args: 'start --port 3002',
      cwd: './apps/institution-teacher-panel',
      watch: false,
      max_memory_restart: '400M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3002,
      },
      error_file: '../../logs/teacher-panel-error.log',
      out_file: '../../logs/teacher-panel-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'student-panel',
      script: 'node_modules/.bin/next',
      args: 'start --port 3003',
      cwd: './apps/institution-student-panel',
      watch: false,
      max_memory_restart: '400M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3003,
      },
      error_file: '../../logs/student-panel-error.log',
      out_file: '../../logs/student-panel-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
