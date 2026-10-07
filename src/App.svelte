<script lang="ts">
  import { onMount } from 'svelte';
  import { SECTION_OPTIONS } from './options';
  import { parseItems, downloadJson } from './json';
  import type { Item } from './types';

  let items = $state<Item[]>([]);
  let selected = $state<number | null>(null);
  let options = $state<string[]>([...SECTION_OPTIONS]);
  let waveCount = $state(0);
  let toAdd = $state(SECTION_OPTIONS[0] ?? '');
  let fileName = $state('dati.json');
  let message = $state<{ kind: 'error' | 'ok'; text: string } | null>(null);

  // problemi per indice elemento: ID vuoto o duplicato
  const problems = $derived.by(() => {
    const seen = new Set<string>();
    const out = new Map<number, string>();
    items.forEach((it, i) => {
      const id = it.id.trim();
      if (!id) out.set(i, 'ID mancante');
      else if (seen.has(id)) out.set(i, 'ID duplicato');
      else seen.add(id);
    });
    return out;
  });

  function syncWavesFromStorage() {
    try {
      const raw = localStorage.getItem('shmup_waves');
      if (raw) {
        const waves = JSON.parse(raw);
        if (Array.isArray(waves)) {
          const waveIds = waves.map((w: any) => String(w.id)).filter(Boolean);
          waveCount = waveIds.length;
          // Unisci le opzioni statiche con gli ID delle wave senza duplicati
          const merged = Array.from(new Set([...SECTION_OPTIONS, ...waveIds]));
          options = merged;
          if (!options.includes(toAdd) && options.length) {
            toAdd = options[0];
          }
        }
      }
    } catch (e) {
      console.warn('Errore lettura shmup_waves:', e);
    }
  }

  onMount(() => {
    syncWavesFromStorage();

    // Reattività automatica tra tab del browser
    const onStorageChange = (ev: StorageEvent) => {
      if (ev.key === 'shmup_waves') {
        syncWavesFromStorage();
        message = { kind: 'ok', text: 'Opzioni wave aggiornate da WaveEditor!' };
      }
    };
    window.addEventListener('storage', onStorageChange);
    return () => window.removeEventListener('storage', onStorageChange);
  });

  function addItem() {
    items.push({ id: '', sections: [] });
    selected = items.length - 1;
  }

  function duplicateItem(i: number) {
    items.splice(i + 1, 0, { id: items[i].id + '-copia', sections: [...items[i].sections] });
    selected = i + 1;
  }

  function removeItem(i: number) {
    items.splice(i, 1);
    selected = items.length ? Math.min(i, items.length - 1) : null;
  }

  function addSection() {
    if (selected === null || !toAdd) return;
    items[selected].sections.push(toAdd);
  }

  function moveSection(i: number, delta: number) {
    if (selected === null) return;
    const list = items[selected].sections;
    const j = i + delta;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
  }

  function removeSection(i: number) {
    if (selected !== null) items[selected].sections.splice(i, 1);
  }

  async function onUpload(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (items.length && !confirm('Il JSON in lavorazione verrà sostituito. Continuare?')) {
      input.value = '';
      return;
    }
    try {
      const parsed = parseItems(await file.text());
      for (const it of parsed)
        for (const s of it.sections) if (!options.includes(s)) options.push(s);
      items = parsed;
      selected = parsed.length ? 0 : null;
      fileName = file.name;
      message = { kind: 'ok', text: `Caricati ${parsed.length} elementi da ${file.name}.` };
    } catch (err) {
      message = { kind: 'error', text: (err as Error).message };
    } finally {
      input.value = '';
    }
  }

  function onDownload() {
    if (problems.size) {
      const first = [...problems.keys()][0];
      selected = first;
      message = { kind: 'error', text: `Elemento ${first + 1}: ${problems.get(first)}. Correggilo per scaricare.` };
      return;
    }
    downloadJson(items, fileName);
    message = { kind: 'ok', text: `Scaricato ${fileName}.` };
  }
</script>

<header class="bar">
  <h1>Editor JSON</h1>
  <div class="bar-actions">
    <button class="btn" onclick={syncWavesFromStorage} title="Ricarica wave create da WaveEditor">
      Sync Wave ({waveCount})
    </button>
    <label class="btn">
      Carica JSON
      <input type="file" accept=".json,application/json" onchange={onUpload} hidden />
    </label>
    <label class="name">
      <span>File</span>
      <input type="text" bind:value={fileName} />
    </label>
    <button class="btn primary" onclick={onDownload} disabled={!items.length}>Scarica JSON</button>
  </div>
</header>

{#if message}
  <p class="msg {message.kind}" role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>
{/if}

<main class="layout">
  <section class="panel list" aria-label="Elementi">
    <div class="panel-head">
      <h2>Elementi ({items.length})</h2>
      <button class="btn primary" onclick={addItem}>Aggiungi elemento</button>
    </div>
    {#if items.length === 0}
      <p class="empty">Nessun elemento. Aggiungine uno o carica un JSON esistente.</p>
    {:else}
      <ul>
        {#each items as it, i}
          <li>
            <button class="row" class:active={selected === i} onclick={() => (selected = i)}>
              <span class="row-id">{it.id || '(senza ID)'}</span>
              <span class="row-meta">
                {#if problems.has(i)}<span class="bad">{problems.get(i)}</span>{/if}
                {it.sections.length} sezioni
              </span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <section class="panel editor" aria-label="Modifica elemento">
    {#if selected === null}
      <p class="empty">Seleziona un elemento per modificarlo.</p>
    {:else}
      <div class="panel-head">
        <h2>Elemento {selected + 1}</h2>
        <div class="inline">
          <button class="btn" onclick={() => duplicateItem(selected!)}>Duplica</button>
          <button class="btn danger" onclick={() => removeItem(selected!)}>Elimina</button>
        </div>
      </div>

      <label class="field">
        <span>ID</span>
        <input type="text" bind:value={items[selected].id} aria-invalid={problems.has(selected)} />
        {#if problems.has(selected)}<small class="bad">{problems.get(selected)}</small>{/if}
      </label>

      <h3>Sezioni</h3>
      {#if items[selected].sections.length === 0}
        <p class="empty">Nessuna sezione. Scegline una qui sotto e aggiungila.</p>
      {:else}
        <ol class="sections">
          {#each items[selected].sections as _, i}
            <li>
              <select bind:value={items[selected].sections[i]} aria-label={`Sezione ${i + 1}`}>
                {#each options as o}<option value={o}>{o}</option>{/each}
              </select>
              <button class="icon" onclick={() => moveSection(i, -1)} disabled={i === 0} aria-label="Sposta su">↑</button>
              <button class="icon" onclick={() => moveSection(i, 1)} disabled={i === items[selected!].sections.length - 1} aria-label="Sposta giù">↓</button>
              <button class="icon danger" onclick={() => removeSection(i)} aria-label="Rimuovi sezione">✕</button>
            </li>
          {/each}
        </ol>
      {/if}

      <div class="add">
        <select bind:value={toAdd} aria-label="Sezione da aggiungere">
          {#each options as o}<option value={o}>{o}</option>{/each}
        </select>
        <button class="btn primary" onclick={addSection}>Aggiungi sezione</button>
      </div>
    {/if}
  </section>

  <section class="panel preview" aria-label="Anteprima JSON">
    <div class="panel-head"><h2>Anteprima</h2></div>
    <pre>{JSON.stringify(items, null, 2)}</pre>
  </section>
</main>

<style>
  .bar {
    display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; justify-content: space-between;
    padding: 0.9rem 1.25rem; background: var(--surface); border-bottom: 1px solid var(--line);
  }
  h1 { margin: 0; font-size: 1.25rem; }
  h2 { margin: 0; font-size: 1rem; }
  h3 { margin: 1.5rem 0 0.5rem; font-size: 0.95rem; }
  .bar-actions, .inline, .add { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
  .name { display: flex; align-items: center; gap: 0.4rem; color: var(--muted); }
  .name input { width: 11rem; }

  .layout {
    display: grid; gap: 1rem; padding: 1rem 1.25rem;
    grid-template-columns: minmax(14rem, 1fr) minmax(20rem, 1.6fr) minmax(14rem, 1fr);
    align-items: start;
  }
  @media (max-width: 960px) { .layout { grid-template-columns: 1fr; } }

  .panel { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 1rem; }
  .panel-head { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; flex-wrap: wrap; }

  ul, ol { list-style: none; margin: 0; padding: 0; }
  .list ul { display: grid; gap: 0.25rem; }
  .row {
    width: 100%; display: flex; justify-content: space-between; gap: 0.5rem; align-items: baseline;
    text-align: left; padding: 0.55rem 0.7rem; background: transparent;
    border: 1px solid transparent; border-radius: 6px; cursor: pointer;
  }
  .row:hover { background: var(--bg); }
  .row.active { border-color: var(--accent); background: #e6f2f1; }
  .row-id { font-weight: 600; overflow-wrap: anywhere; }
  .row-meta { color: var(--muted); font-size: 0.85rem; white-space: nowrap; }

  .field { display: grid; gap: 0.3rem; }
  .field span { font-weight: 600; font-size: 0.9rem; }
  input[type='text'], select {
    padding: 0.45rem 0.6rem; border: 1px solid var(--line); border-radius: 6px; background: #fff; min-width: 0;
  }
  input[aria-invalid='true'] { border-color: var(--danger); }

  .sections { display: grid; gap: 0.4rem; counter-reset: s; }
  .sections li { display: flex; gap: 0.35rem; align-items: center; counter-increment: s; }
  .sections li::before { content: counter(s); width: 1.6rem; text-align: right; color: var(--muted); font-variant-numeric: tabular-nums; }
  .sections select { flex: 1; }
  .add { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--line); }
  .add select { flex: 1; min-width: 7rem; }

  .btn, .icon {
    display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
    padding: 0.45rem 0.8rem; border: 1px solid var(--line); border-radius: 6px; background: #fff;
  }
  .icon { padding: 0.35rem 0.55rem; }
  .btn:hover:not(:disabled), .icon:hover:not(:disabled) { background: var(--bg); }
  .btn.primary { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
  .btn.primary:hover:not(:disabled) { background: #095a56; }
  .danger { color: var(--danger); }
  button:disabled { opacity: 0.45; cursor: not-allowed; }

  .empty { color: var(--muted); margin: 0.5rem 0; }
  .bad { color: var(--danger); font-size: 0.85rem; margin-right: 0.4rem; }
  .msg { margin: 0.75rem 1.25rem 0; padding: 0.6rem 0.9rem; border-radius: 6px; }
  .msg.ok { background: #e6f2f1; color: #0b4f4b; }
  .msg.error { background: #fbe9e7; color: var(--danger); }

  pre {
    margin: 0; max-height: 70vh; overflow: auto; padding: 0.75rem; background: #f6f8fa;
    border-radius: 6px; font: 0.85rem/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
</style>
