# Editor JSON

Vite + Svelte + TypeScript. Crea e modifica un JSON di elementi `{ id, sections[] }`,
con upload di un JSON esistente e download di quello corrente.

## Sviluppo
    npm install
    npm run dev

## Valori della combo
Modifica `src/options.ts`.

## Deploy su GitHub Pages
1. Fai push su `main`.
2. In *Settings → Pages* imposta *Source: GitHub Actions*.
3. Il workflow `.github/workflows/deploy.yml` esegue check, build e pubblicazione.
