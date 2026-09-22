/**
 * Portão SDD: garante que a matriz specs/traceability.md continua verdadeira.
 * Para cada linha, o identificador precisa aparecer nos arquivos de
 * implementação e de teste indicados. Roda no CI antes dos testes.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const MATRIX = resolve(ROOT, 'specs/traceability.md');
const SKIP = new Set(['—', '-', 'pipeline', 'Checkov']);

type Row = { ids: string[]; impl: string; test: string; line: number };

function expandIds(cell: string): string[] {
  const ids: string[] = [];
  for (const chunk of cell.split(',').map((part) => part.trim())) {
    const range = /^([A-Z][A-Z-]*?)(\d+)\.\.(?:[A-Z][A-Z-]*?)?(\d+)$/.exec(chunk);
    if (range !== null) {
      const [, prefix, from, to] = range;
      for (let n = Number(from); n <= Number(to); n += 1) {
        ids.push(`${prefix}${n}`);
      }
      continue;
    }
    if (chunk !== '') ids.push(chunk);
  }
  return ids;
}

function parseMatrix(markdown: string): Row[] {
  const rows: Row[] = [];
  markdown.split('\n').forEach((line, index) => {
    if (!line.startsWith('|')) return;
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim().replaceAll('`', ''));
    if (cells.length !== 4) return;
    const [id, , impl, test] = cells as [string, string, string, string];
    if (id === 'ID' || id.startsWith('--')) return;
    rows.push({ ids: expandIds(id), impl, test, line: index + 1 });
  });
  return rows;
}

function readFileOrNull(relative: string): string | null {
  try {
    return readFileSync(resolve(ROOT, relative), 'utf8');
  } catch {
    return null;
  }
}

const rows = parseMatrix(readFileSync(MATRIX, 'utf8'));
if (rows.length === 0) {
  console.error('traceability.md: nenhuma linha de matriz reconhecida.');
  process.exit(1);
}

const problems: string[] = [];
const cache = new Map<string, string | null>();

for (const row of rows) {
  for (const target of [row.impl, row.test]) {
    if (SKIP.has(target)) continue;
    if (!cache.has(target)) cache.set(target, readFileOrNull(target));
    const content = cache.get(target) ?? null;
    if (content === null) {
      problems.push(`linha ${row.line}: arquivo inexistente "${target}"`);
      continue;
    }
    for (const id of row.ids) {
      if (!content.includes(id)) {
        problems.push(`linha ${row.line}: "${id}" não é citado em ${target}`);
      }
    }
  }
}

if (problems.length > 0) {
  console.error(`Rastreabilidade quebrada (${problems.length} problema(s)):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(`Rastreabilidade OK: ${rows.length} linhas verificadas.`);
