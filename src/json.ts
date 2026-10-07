import type { Item } from './types';

/** Accetta un array di elementi oppure un singolo elemento; lancia un Error leggibile se il formato non è valido. */
export function parseItems(text: string): Item[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Il file non è un JSON valido.');
  }
  const list: unknown[] = Array.isArray(data) ? data : [data];
  return list.map((raw, i) => {
    const r = raw as Partial<Item> | null;
    if (
      typeof r !== 'object' || r === null ||
      typeof r.id !== 'string' ||
      !Array.isArray(r.sections) ||
      !r.sections.every((s) => typeof s === 'string')
    ) {
      throw new Error(`Elemento ${i + 1}: servono "id" (testo) e "sections" (elenco di testi).`);
    }
    return { id: r.id, sections: [...r.sections] };
  });
}

export function downloadJson(items: Item[], filename: string): void {
  const blob = new Blob([JSON.stringify(items, null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
