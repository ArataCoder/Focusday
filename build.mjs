// Сборка ES-модулей src/js/* → src/focusday.js (один классический скрипт: работает и с file://, и в Tauri)
import { build } from 'esbuild';
const watch = process.argv.includes('--watch');
const opts = { entryPoints: ['src/js/main.js'], bundle: true, format: 'iife', target: ['chrome105', 'edge105', 'safari15'],
  outfile: 'src/focusday.js', charset: 'utf8', legalComments: 'none', minify: process.argv.includes('--minify'),
  banner: { js: '/* Focusday — собрано из src/js/*.js (npm run bundle). Не правьте этот файл руками. */' } };
if (watch) { const { context } = await import('esbuild'); const ctx = await context(opts); await ctx.watch(); console.log('esbuild: watching src/js …'); }
else { await build(opts); console.log('esbuild: src/focusday.js готов'); }
