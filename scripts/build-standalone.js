import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

export const standalonePath = new URL('../index.html', import.meta.url);

export async function buildStandalone() {
  const { output } = await build({
    base: './',
    logLevel: 'warn',
    build: { write: false, assetsInlineLimit: Infinity, modulePreload: false },
  });
  const html = output.find(file => file.fileName === 'index.html');
  const css = output.find(file => file.fileName.endsWith('.css'));
  const js = output.find(file => file.type === 'chunk');
  assert(output.length === 3 && html && css && js &&
    !js.imports.length && !js.dynamicImports.length,
  'Standalone build requires one HTML, one CSS, and one JS bundle without imports');

  const script = `<script type="module" crossorigin src="./${js.fileName}"></script>`;
  const style = `<link rel="stylesheet" crossorigin href="./${css.fileName}">`;
  assert(html.source.includes(script) && html.source.includes(style), 'Vite output tags changed');

  return '<!-- 由 npm run build:standalone 生成，请勿手动修改。 -->\n' + html.source
    .replace(script, () => `<script type="module">${js.code.replace(/<\/script/gi, '<\\/script')}</script>`)
    .replace(style, () => `<style>${css.source.replace(/<\/style/gi, '<\\/style')}</style>`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await writeFile(standalonePath, await buildStandalone());
}
