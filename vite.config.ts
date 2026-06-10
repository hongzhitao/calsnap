import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/calsnap/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'CalSnap',
        short_name: 'CalSnap',
        theme_color: '#FAFBF7',
        background_color: '#FAFBF7',
        display: 'standalone',
        icons: [
          { src: '/calsnap/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/calsnap/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
    {
      name: 'ark-relay',
      configureServer(server) {
        server.middlewares.use('/api/ark-relay', async (req, res) => {
          // Collect request body
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', async () => {
            try {
              const { url, headers: reqHeaders, body: reqBody } = JSON.parse(body);
              console.log('[Ark Relay] ->', url);

              const arkRes = await fetch(url, {
                method: 'POST',
                headers: reqHeaders,
                body: JSON.stringify(reqBody),
              });

              const text = await arkRes.text();
              res.statusCode = arkRes.status;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ status: arkRes.status, body: text }));
            } catch (e: any) {
              console.error('[Ark Relay] error:', e);
              res.statusCode = 500;
              res.end(JSON.stringify({ status: 500, body: e.message }));
            }
          });
        });
      },
    },
  ],
  server: {
    proxy: {
      '/api/proxy': {
        target: 'https://ark.cn-beijing.volces.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/proxy/, '') || '/',
        secure: false,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
  },
});
