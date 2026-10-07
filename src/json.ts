import type { Item } from './types';

/** Parses an array of items or a single item; throws a readable Error if invalid format. */
export function parseItems(text: string): Item[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('File is not valid JSON.');
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
      throw new Error(`Item ${i + 1}: requires "id" (string) and "sections" (array of strings).`);
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