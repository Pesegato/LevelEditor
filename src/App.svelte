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
  let fileName = $state('level_data.json');
  let message = $state<{ kind: 'error' | 'ok'; text: string } | null>(null);

  // Validation per item index: missing or duplicate ID
  const problems = $derived.by(() => {
    const seen = new Set<string>();
    const out = new Map<number, string>();
    items.forEach((it, i) => {
      const id = it.id.trim();
      if (!id) out.set(i, 'Missing ID');
      else if (seen.has(id)) out.set(i, 'Duplicate ID');
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

          if (waveIds.length > 0) {
            // Se ci sono wave reali, sostituisci completamente le opzioni di default!
            options = Array.from(new Set(waveIds));
          } else {
            // Altrimenti mantieni quelle di default
            options = [...SECTION_OPTIONS];
          }

          if (!options.includes(toAdd) && options.length) {
            toAdd = options[0];
          }
        }
      }
    } catch (e) {
      console.warn('Error reading shmup_waves from localStorage:', e);
    }
  }

  onMount(() => {
    syncWavesFromStorage();

    // Cross-tab real-time sync
    const onStorageChange = (ev: StorageEvent) => {
      if (ev.key === 'shmup_waves') {
        syncWavesFromStorage();
        message = { kind: 'ok', text: 'Wave options updated from WaveEditor!' };
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
    items.splice(i + 1, 0, { id: items[i].id + '-copy', sections: [...items[i].sections] });
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
    if (items.length && !confirm('The current working JSON will be overwritten. Continue?')) {
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
      message = { kind: 'ok', text: `Loaded ${parsed.length} items from ${file.name}.` };
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
      message = { kind: 'error', text: `Item ${first + 1}: ${problems.get(first)}. Please fix it before downloading.` };
      return;
    }
    downloadJson(items, fileName);
    message = { kind: 'ok', text: `Downloaded ${fileName}.` };
  }
</script>

<header class="bar">
  <h1>Level Editor</h1>
  <div class="bar-actions">
    <button class="btn" onclick={syncWavesFromStorage} title="Reload waves from WaveEditor">
      Sync Waves ({waveCount})
    </button>
    <label class="btn">
      Load JSON
      <input type="file" accept=".json,application/json" onchange={onUpload} hidden />
    </label>
    <label class="name">
      <span>File</span>
      <input type="text" bind:value={fileName} />
    </label>
    <button class="btn primary" onclick={onDownload} disabled={!items.length}>Download JSON</button>
  </div>
</header>

{#if message}
  <p class="msg {message.kind}" role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>
{/if}

<main class="layout">
  <section class="panel list" aria-label="Items">
    <div class="panel-head">
      <h2>Items ({items.length})</h2>
      <button class="btn primary" onclick={addItem}>Add item</button>
    </div>
    {#if items.length === 0}
      <p class="empty">No items yet. Add one or load an existing JSON file.</p>
    {:else}
      <ul>
        {#each items as it, i}
          <li>
            <button class="row" class:active={selected === i} onclick={() => (selected = i)}>
              <span class="row-id">{it.id || '(no ID)'}</span>
              <span class="row-meta">
                {#if problems.has(i)}<span class="bad">{problems.get(i)}</span>{/if}
                {it.sections.length} {it.sections.length === 1 ? 'section' : 'sections'}
              </span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <section class="panel editor" aria-label="Edit item">
    {#if selected === null}
      <p class="empty">Select an item to edit.</p>
    {:else}
      <div class="panel-head">
        <h2>Item {selected + 1}</h2>
        <div class="inline">
          <button class="btn" onclick={() => duplicateItem(selected!)}>Duplicate</button>
          <button class="btn danger" onclick={() => removeItem(selected!)}>Delete</button>
        </div>
      </div>

      <label class="field">
        <span>ID</span>
        <input type="text" bind:value={items[selected].id} aria-invalid={problems.has(selected)} />
        {#if problems.has(selected)}<small class="bad">{problems.get(selected)}</small>{/if}
      </label>

      <h3>Sections</h3>
      {#if items[selected].sections.length === 0}
        <p class="empty">No sections. Choose one below and click Add section.</p>
      {:else}
        <ol class="sections">
          {#each items[selected].sections as _, i}
            <li>
              <select bind:value={items[selected].sections[i]} aria-label={`Section ${i + 1}`}>
                {#each options as o}<option value={o}>{o}</option>{/each}
              </select>
              <button class="icon" onclick={() => moveSection(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
              <button class="icon" onclick={() => moveSection(i, 1)} disabled={i === items[selected!].sections.length - 1} aria-label="Move down">↓</button>
              <button class="icon danger" onclick={() => removeSection(i)} aria-label="Remove section">✕</button>
            </li>
          {/each}
        </ol>
      {/if}

      <div class="add">
        <select bind:value={toAdd} aria-label="Section to add">
          {#each options as o}<option value={o}>{o}</option>{/each}
        </select>
        <button class="btn primary" onclick={addSection}>Add section</button>
      </div>
    {/if}
  </section>

  <section class="panel preview" aria-label="JSON preview">
    <div class="panel-head"><h2>JSON Preview</h2></div>
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
  .list ul { display: flex; flex-direction: column; gap: 0.35rem; }
  .row {
    width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;
    padding: 0.55rem 0.7rem; border-radius: 6px; border: 1px solid transparent; background: transparent;
    color: inherit; text-align: left; cursor: pointer; font: inherit;
  }
  .row:hover { background: var(--hover); }
  .row.active { background: var(--active); border-color: var(--line); }
  .row-id { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .row-meta { font-size: 0.8rem; color: var(--muted); display: flex; gap: 0.4rem; align-items: center; }

  .field { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 1rem; }
  .field span { font-size: 0.85rem; color: var(--muted); }

  .sections { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1rem; }
  .sections li { display: flex; gap: 0.4rem; align-items: center; }
  .sections select { flex: 1; }

  .empty { color: var(--muted); font-style: italic; font-size: 0.9rem; }
  .bad { color: var(--danger); font-size: 0.75rem; }

  pre {
    margin: 0; padding: 0.75rem; background: var(--bg); border: 1px solid var(--line);
    border-radius: 6px; overflow: auto; max-height: 70vh; font-size: 0.8rem;
  }

  .msg {
    margin: 0.75rem 1.25rem 0; padding: 0.6rem 0.9rem; border-radius: 6px; font-size: 0.9rem;
  }
  .msg.ok { background: #14351e; color: #7ee787; border: 1px solid #238636; }
  .msg.error { background: #3c1414; color: #ff7b72; border: 1px solid #da3633; }
</style>