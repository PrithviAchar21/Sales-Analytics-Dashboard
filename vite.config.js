import { defineConfig, loadEnv } from 'vite';
import express from 'express';
import react from '@vitejs/plugin-react';
import { createApi } from './server/api.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'SALESPULSE_');
  function mountApi(server) {
    const { api, close } = createApi({
      databasePath: env.SALESPULSE_DB,
      importToken: env.SALESPULSE_IMPORT_TOKEN,
    });
    const app = express();
    app.use(api);
    server.middlewares.use('/api', app);
    server.httpServer?.once('close', close);
  }
  return {
    plugins: [react(), {
      name: 'salespulse-api',
      configureServer: mountApi,
      configurePreviewServer: mountApi,
    }],
  };
});
