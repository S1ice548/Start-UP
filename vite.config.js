import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: false
  },
  test: {
    // Exclude the reference project copy (Next.js app with its own tests)
    exclude: ['nee-noi-debt-planner/**', 'node_modules/**']
  }
});
