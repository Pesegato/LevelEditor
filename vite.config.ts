import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// base './' => funziona su GitHub Pages qualunque sia il nome del repository
export default defineConfig({
  base: './',
  plugins: [svelte()],
});
