import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {execSync} from 'child_process';
import path from 'path';
import {defineConfig} from 'vite';

// Where the Laravel API runs during local development. The browser always calls
// the API on its own origin (/api/*); Vite proxies that prefix to this target so
// development matches the same-origin setup Caddy provides in production.
const API_PROXY_TARGET = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8000';

// Version shown in the footer: the release tag ("v0.2.0"), or the tag plus the
// commits since it ("v0.2.0-3-g7517a80"). APP_VERSION wins when git is not
// available (e.g. the Node container on the VPS).
function appVersion(): string {
  if (process.env.APP_VERSION) {
    return process.env.APP_VERSION;
  }
  try {
    return execSync('git describe --tags --always', {
      cwd: import.meta.dirname,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return 'dev';
  }
}

export default defineConfig(() => {
  const disableHmr = process.env.DISABLE_HMR === 'true';
  // When the dev server sits behind Caddy, the browser reaches it on port 443.
  const hmrClientPort = process.env.VITE_HMR_CLIENT_PORT
    ? Number(process.env.VITE_HMR_CLIENT_PORT)
    : undefined;

  return {
    plugins: [react(), tailwindcss()],
    define: {
      __APP_VERSION__: JSON.stringify(appVersion()),
    },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    // @ts-ignore
    test: {
      globals: true,
      environment: 'jsdom',
    },
    server: {
      strictPort: true,
      proxy: {
        '/api': {
          target: API_PROXY_TARGET,
          changeOrigin: true,
        },
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâ€”file watching is disabled to prevent flickering during agent edits.
      hmr: disableHmr ? false : hmrClientPort ? { clientPort: hmrClientPort } : true,
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: disableHmr ? null : {},
    },
  };
});
