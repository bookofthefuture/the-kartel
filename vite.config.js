// vite.config.js
import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';

export default defineConfig({
  // Build configuration
  build: {
    outDir: 'dist',
    emptyOutDir: false, // Don't clear the entire dist folder
    rollupOptions: {
      // Define multiple entry points for different bundles
      input: {
        // Main bundles for different page types
        'js/members-bundle': '/src/members.js',
        'js/admin-bundle': '/src/admin.js',
        'js/public-bundle': '/src/public.js'
      },
      output: {
        // Customize output names
        entryFileNames: '[name].min.js',
        chunkFileNames: '[name]-[hash].min.js',
        assetFileNames: '[name]-[hash][extname]'
      }
    },
    // Minification and optimization
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.logs in production
        drop_debugger: true
      }
    },
    // Source maps for debugging
    sourcemap: false // Disable for production to reduce file size
  },

  // Plugins
  plugins: [
    // Legacy browser support
    legacy({
      targets: ['> 1%', 'last 2 versions', 'not dead'],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime']
    })
  ],

  // Development server (not used for build but good to have)
  server: {
    port: 3000,
    open: false
  },

  // Define global constants
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development')
  }
});