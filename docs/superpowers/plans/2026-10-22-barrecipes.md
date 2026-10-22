# BarRecipes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Webapp statica per tablet che mostra i drink possibili in base alla dispensa, con dosi scalabili, bottiglie tracciate e funzioni Gemini.

**Architecture:** HTML/CSS/JS vanilla con moduli ES, nessun build step e nessun backend. La logica pura (misure, tipi, match, dosi, backup, validazione Gemini) vive in moduli `js/` testati con `node --test`. La UI (`js/ui/`) usa quei moduli e si verifica a mano nel browser. Tutti i dati restano in `localStorage`.

**Tech Stack:** JS ES2022 modules, `node:test` + `node:assert/strict` (Node ≥ 20, nessuna dipendenza npm), TheCocktailDB API v1 chiave `1`, Gemini REST `generateContent`, PWA (manifest + service worker).

**Spec:** `docs/superpowers/specs/2026-10-22-barrecipes-design.md`

## Global Constraints

- Budget 0: nessuna dipendenza a pagamento, nessun backend, nessuna libreria npm runtime.
- UI in italiano. Unità di default: `oz`.
- Chiave Gemini mai nel codice, nel repo o nell'export. Solo in `localStorage` (`br.geminiKey`).
- Ogni testo esterno (TheCocktailDB, Gemini, input utente, file importati) passa da `esc()` prima di finire in `innerHTML`.
- Conversioni: 1 oz = 30 ml = 3 cl. Arrotondamenti: oz a ¼, ml a 5, cl a 0,5.
- Porzioni: `[0.5, 1, 2, 3, 4]`. Intensità: `leggero` = 0.7, `normale` = 1, `forte` = 1.25 sugli alcolici.
- Base sempre disponibile: `ghiaccio`, `acqua`, `zucchero`, `sale` (disattivabili dalle impostazioni).
- Tablet in orizzontale come target. Nessuno scroll orizzontale fino a 768px di larghezza.
- Ogni accesso a `localStorage` è dentro try/catch (`js/store.js`).

## Review Focus

1. **Gemini risponde con JSON non valido, id inesistenti o campi mancanti:** messaggio "Risposta non valida, riprova" e nessun crash. Gli id sconosciuti vengono scartati (test in Task 9).
2. **Primo avvio offline o fallimento di alcune lettere del catalogo:** errore visibile con tasto "Riprova". Una cache precedente resta intatta se il refresh fallisce (test in Task 2).
3. **File importato malformato o di un'altra app:** rifiutato con un messaggio. I dati esistenti non vengono toccati (test in Task 8).
4. **"Fatto!" con quantità al limite:** una bottiglia non va mai sotto 0. A ≤ 0 viene rimossa. Doppio tocco: il tasto si disabilita fino al re-render (test in Task 4).
5. **`localStorage` non disponibile o pieno:** l'app funziona in memoria e mostra un avviso una volta (test in Task 4).

---

## File Structure

```
index.html                 shell, nav in basso, <main id="view">
styles.css                 token colore (light/dark), layout tablet
manifest.webmanifest, sw.js, icon.svg
data/types.json            tipi generici + mappa nomi CocktailDB → tipo
js/
  dom.js                   esc(), h() helper
  measure.js               parse/format misure
  types.js                 risoluzione tipi, gerarchia
  catalog.js               fetch + normalize + cache TheCocktailDB
  store.js                 wrapper localStorage
  pantry.js                dispensa, stasera, disponibilità, scalare
  match.js                 stato di un drink rispetto alla dispensa
  dose.js                  porzioni, intensità, combinazioni fattibili
  backup.js                export/import
  gemini.js                chiamate + validazione risposte
  app.js                   bootstrap, router, stato globale
  ui/drinks.js ui/card.js ui/pantry.js ui/recipes.js ui/settings.js
tests/*.test.js            un file per modulo puro
scripts/ingredient-freq.js stampa frequenza ingredienti nel catalogo
```

## Data Model (condiviso da tutti i task)

```js
// Type (data/types.json → types[])
{ id: 'rum-bianco', name: 'Rum bianco', cat: 'spirit', parent: 'rum' }
// cat ∈ 'spirit'|'liqueur'|'sweet'|'sour'|'mixer'|'juice'|'fresh'|'base'|'other'
// parent opzionale. Richiesto il padre → basta qualsiasi figlio. Richiesto il figlio → solo lui. Fratelli = stesso parent.

// data/types.json
{ "types": [Type...], "map": { "Light rum": "rum-bianco", "Campari": "bitter-rosso", ... } }

// Ingredient
{ raw: 'Light rum', type: 'rum-bianco', oz: 1.5 | null, text: '1 1/2 oz' }

// Drink
{ id: 'cdb:11007', name, thumb: string|null, alcoholic: 'yes'|'no'|'optional',
  instructions: string, ingredients: Ingredient[],
  source: 'cocktaildb'|'manual'|'youtube', url?: string }

// Pantry
{ items: { [typeId]: { oz: number|null } } }   // oz null = solo presenza, non scalata
```

Chiavi `localStorage`: `br.catalog` ({ fetchedAt, drinks }), `br.pantry`, `br.recipes` (Drink[]), `br.off` (typeId[]), `br.settings` ({ unit, basics: boolean, model }), `br.geminiKey`.

---

### Task 1: Scaffold + misure

**Files:**
- Create: `.gitignore`, `package.json`, `js/dom.js`, `js/measure.js`
- Test: `tests/measure.test.js`, `tests/dom.test.js`

**Interfaces:**
- Produces: `parseMeasure(str: string|null) -> { oz: number|null, text: string }`; `formatAmount(oz: number, unit: 'oz'|'ml'|'cl') -> string`; `esc(s: unknown) -> string`

- [ ] **Step 1: Init.** `git init`. `.gitignore` contiene `.superpowers/` e `node_modules/`. `package.json`: `{"name":"barrecipes","private":true,"type":"module","scripts":{"test":"node --test tests/"}}`.

- [ ] **Step 2: Scrivi i test che falliscono**

```js
// tests/measure.test.js
test('oz con frazioni', () => assert.equal(parseMeasure('1 1/2 oz ').oz, 1.5));
test('cl e ml', () => { assert.equal(parseMeasure('3 cl').oz, 1); assert.equal(parseMeasure('60 ml').oz, 2); });
test('shot, tsp, tblsp, dash, splash, cup', () => {
  assert.equal(parseMeasure('1 shot').oz, 1.5); assert.equal(parseMeasure('1 tsp').oz, 1/6);
  assert.equal(parseMeasure('1 tblsp').oz, 0.5); assert.equal(parseMeasure('2 dashes').oz, 2/32);
  assert.equal(parseMeasure('1 splash').oz, 0.25); assert.equal(parseMeasure('1 cup').oz, 8);
});
test('range prende il primo valore', () => assert.equal(parseMeasure('1-2 oz').oz, 1));
test('non interpretabili → null, text conservato', () => {
  for (const s of ['Top', 'Fill with', 'Juice of 1', '2 parts', '', null]) assert.equal(parseMeasure(s).oz, null);
  assert.equal(parseMeasure('Juice of 1').text, 'Juice of 1');
});
test('format oz con frazioni unicode', () => { assert.equal(formatAmount(1.5, 'oz'), '1 ½ oz'); assert.equal(formatAmount(0.75, 'oz'), '¾ oz'); assert.equal(formatAmount(0.3, 'oz'), '¼ oz'); });
test('format ml e cl arrotondati', () => { assert.equal(formatAmount(1.5, 'ml'), '45 ml'); assert.equal(formatAmount(0.6, 'ml'), '20 ml'); assert.equal(formatAmount(1.5, 'cl'), '4,5 cl'); });
// tests/dom.test.js
test('esc', () => assert.equal(esc('<a href="x">&\''), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;'));
```

- [ ] **Step 3:** `npm test` → FAIL (moduli mancanti).
- [ ] **Step 4: Implementa** `js/measure.js` e `js/dom.js`. Regex sul numero iniziale (intero, decimale, `a b/c`, `a/b`), poi unità case-insensitive con plurali. `formatAmount` arrotonda a ¼ oz (minimo ¼ se > 0), usa `¼ ½ ¾` e la virgola decimale per cl.
- [ ] **Step 5:** `npm test` → PASS.
- [ ] **Step 6: Commit** `feat: scaffold e parser misure`

---

### Task 2: Catalogo TheCocktailDB

**Files:**
- Create: `js/catalog.js`, `scripts/ingredient-freq.js`
- Test: `tests/catalog.test.js`, `tests/fixtures/margarita.json` (risposta reale di `search.php?s=margarita`, solo il primo drink)

**Interfaces:**
- Consumes: `parseMeasure`
- Produces: `normalizeDrink(raw) -> Drink` (con `type: null` sugli ingredienti), `fetchCatalog(fetchFn = fetch) -> Promise<Drink[]>`, `CATALOG_URL = 'https://www.thecocktaildb.com/api/json/v1/1/search.php?f='`, `LETTERS = 'abcdefghijklmnopqrstuvwxyz0123456789'`

- [ ] **Step 1: Test che falliscono**

```js
test('normalize margarita', () => {
  const d = normalizeDrink(fixture);
  assert.equal(d.id, 'cdb:11007'); assert.equal(d.alcoholic, 'yes'); assert.equal(d.source, 'cocktaildb');
  assert.match(d.instructions, /Strofina il bordo/);            // preferisce strInstructionsIT
  assert.deepEqual(d.ingredients[0], { raw: 'Tequila', type: null, oz: 1.5, text: '1 1/2 oz' });
  assert.equal(d.ingredients[3].oz, null);                       // Salt senza misura
});
test('fallback a strInstructions se IT manca', ...);
test('alcoholic mapping', () => { /* 'Non alcoholic'→'no', 'Optional alcohol'→'optional' */ });
test('fetchCatalog unisce le lettere, salta drinks:null, dedup per id', async () => { /* fetchFn finto */ });
test('fetchCatalog rigetta se una lettera fallisce (rete o !ok)', async () => {
  await assert.rejects(fetchCatalog(async (u) => u.endsWith('=q') ? { ok: false } : okEmpty));
});
```

- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3: Implementa** `js/catalog.js`. Le richieste vanno in sequenza o a gruppi di 6 per non martellare l'API. `fetchCatalog` non scrive in cache: lo fa il chiamante solo se ha successo (Review Focus 2).
- [ ] **Step 4:** `scripts/ingredient-freq.js`: scarica il catalogo con `fetchCatalog` e stampa `count\tname` ordinato per frequenza. Eseguilo: `node scripts/ingredient-freq.js > /tmp/freq.txt` → circa 400+ righe.
- [ ] **Step 5:** `npm test` → PASS. **Commit** `feat: fetch e normalize catalogo`

---

### Task 3: Tipi generici

**Files:**
- Create: `data/types.json`, `js/types.js`
- Test: `tests/types.test.js`

**Interfaces:**
- Produces: `loadTypes(json) -> TypeIndex`; `resolveType(idx, raw: string) -> string` (id mappato, oppure `'x:' + raw.toLowerCase().trim()` e registra un tipo `{id, name: raw, cat:'other'}`); `typeName(idx, id) -> string`; `satisfiers(idx, id) -> string[]` (id + figli); `siblings(idx, id) -> string[]`; `attachTypes(idx, drinks: Drink[]) -> Drink[]`

- [ ] **Step 1: Test che falliscono** (con `data/types.json` reale)

```js
test('marche → tipo', () => { assert.equal(resolveType(idx,'Bacardi'), 'rum-bianco'); assert.equal(resolveType(idx,'Light rum'), 'rum-bianco'); assert.equal(resolveType(idx,'Absolut Citron'), 'vodka'); assert.equal(resolveType(idx,'Campari'), 'bitter-rosso'); assert.equal(resolveType(idx,'Aperol'), 'bitter-arancio'); });
test('generico soddisfatto dai figli', () => assert.deepEqual(new Set(satisfiers(idx,'rum')), new Set(['rum','rum-bianco','rum-scuro', /* altri figli */ ])));
test('fratelli non si soddisfano', () => assert.ok(!satisfiers(idx,'bitter-rosso').includes('bitter-arancio')));
test('siblings', () => assert.ok(siblings(idx,'bitter-rosso').includes('bitter-arancio')));
test('sconosciuto → x:', () => { assert.equal(resolveType(idx,'Dragon Fruit '), 'x:dragon fruit'); assert.equal(typeName(idx,'x:dragon fruit'), 'Dragon Fruit'); });
test('base esistono', () => { for (const b of ['ghiaccio','acqua','zucchero','sale']) assert.equal(idx.byId[b].cat, 'base'); });
test('ogni map punta a un tipo esistente e ogni parent esiste', ...);
test('copertura: ogni ingrediente con frequenza ≥ 3 in freq è mappato', ...); // fixture tests/fixtures/freq.txt da Task 2
```

- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3: Scrivi `data/types.json`.** Mappa tutti gli ingredienti con frequenza ≥ 3 (copia `/tmp/freq.txt` in `tests/fixtures/freq.txt`). Nomi in italiano. Categorie: `spirit` (distillati), `liqueur` (liquori, vermouth, bitter, vini), `sweet` (sciroppi, zucchero, miele, granatina), `sour` (succo di lime/limone), `mixer` (soda, tonica, cola, ginger beer/ale, 7-Up, champagne/prosecco come top), `juice` (succhi da allungo: arancia, ananas, mirtillo, pomodoro), `fresh` (frutta, menta, uova, panna), `base`. Includi i genitori generici `rum`, `whisky`, `vodka`, `brandy`, `bitter-aperitivo` ecc. `Ice`→`ghiaccio`, `Water`→`acqua`, `Sugar`/`Sugar syrup`→`zucchero`/`sciroppo-zucchero`, `Salt`→`sale`.
- [ ] **Step 4: Implementa `js/types.js`.**
- [ ] **Step 5:** `npm test` → PASS. **Commit** `feat: tabella tipi generici`

---

### Task 4: Store e dispensa

**Files:**
- Create: `js/store.js`, `js/pantry.js`
- Test: `tests/store.test.js`, `tests/pantry.test.js`

**Interfaces:**
- Produces:
  - `store.get(key, fallback)`, `store.set(key, value) -> boolean` (false se fallisce), `store.ok: boolean`. Fallback in memoria se `globalThis.localStorage` manca o lancia.
  - `availableSet(idx, pantry, off: string[], basics: boolean) -> Map<typeId, oz|null>`: voci della dispensa meno quelle spente, più i 4 base (`oz: null`) se `basics`.
  - `pickSource(idx, avail, typeId) -> typeId|null`: tra `satisfiers` disponibili sceglie un non tracciato (`oz null`) se c'è, altrimenti quello con più oz.
  - `consume(pantry, usage: {typeId, oz}[]) -> Pantry`: nuovo oggetto. Sottrae solo da voci con oz numerico. Elimina la voce se il risultato è ≤ 0.

- [ ] **Step 1: Test che falliscono**

```js
test('store in memoria se localStorage lancia', () => { /* globalThis.localStorage con getItem che lancia → get ritorna fallback, set ritorna false, store.ok false */ });
test('availableSet esclude spenti, aggiunge base', ...);
test('pickSource preferisce non tracciato, poi più oz', () => { /* rum-bianco 2oz, rum-scuro 5oz → 'rum-scuro' per 'rum' */ });
test('consume scala e rimuove a zero', () => {
  const p = consume({ items: { tequila: { oz: 1.5 }, lime: { oz: null } } }, [{ typeId: 'tequila', oz: 1.5 }, { typeId: 'lime', oz: 1 }]);
  assert.equal(p.items.tequila, undefined); assert.deepEqual(p.items.lime, { oz: null });
});
test('consume non va mai negativo', () => { /* 1oz - 2oz → voce rimossa */ });
```

- [ ] **Step 2–4:** FAIL → implementa → PASS.
- [ ] **Step 5: Commit** `feat: store e dispensa`

---

### Task 5: Match drink ↔ dispensa

**Files:**
- Create: `js/match.js`
- Test: `tests/match.test.js`

**Interfaces:**
- Consumes: `satisfiers`, `pickSource`, `minDose` (Task 6, vedi sotto: in questo task usa `minOz = ing.oz * 0.5 * (isAlcohol ? 0.7 : 1)` tramite `minDose` importato da `dose.js`. Crea `dose.js` con solo `minDose` e completalo in Task 6)
- Produces: `evaluate(idx, drink, avail, off: string[]) -> { status: 'ok'|'miss1'|'missN', missing: { type, reason: 'absent'|'off'|'low' }[] }`; `sortForGrid(results) -> results` (ok, poi miss1, nome A–Z)

- [ ] **Step 1: Test che falliscono**

```js
test('ok se tutto disponibile, base inclusi', ...);
test('padre richiesto, figlio posseduto → ok', ...);
test('mancante uno → miss1 con reason absent', ...);
test('spento → reason off', ...);
test('poco: 0.4 oz di tequila, Margarita (1.5 oz, min ½×0.7 = 0.525) → low', ...);
test('misura null non blocca per quantità', ...);
test('due mancanti → missN', ...);
```

- [ ] **Step 2–4:** FAIL → implementa → PASS. Un ingrediente con `reason` diverso conta una volta sola. Per il check `low` usa la fonte di `pickSource`.
- [ ] **Step 5: Commit** `feat: match drink-dispensa`

---

### Task 6: Dosi e intensità

**Files:**
- Modify: `js/dose.js`
- Test: `tests/dose.test.js`

**Interfaces:**
- Produces:
  - `PORTIONS = [0.5,1,2,3,4]`, `STRENGTH = { leggero: 0.7, normale: 1, forte: 1.25 }`
  - `computeDose(idx, drink, { portion, strength }) -> { lines: { raw, type, oz: number|null, text, added?: true }[] }`
  - `feasible(idx, drink, avail, sub?: { from: typeId, to: typeId, oz: number|null }) -> { portion, strength }[]`
  - `minDose(idx, ing) -> number|null`
  - `usage(idx, lines, avail) -> { typeId, oz }[]` (fonte da `pickSource`, solo righe con oz)

Algoritmo (non deducibile dai test, va seguito):
```
alcol = righe con cat spirit|liqueur;  a = STRENGTH[strength]
lungo = esiste riga cat mixer, oppure juice con oz ≥ 2;  allungo = la riga mixer/juice con oz maggiore (null oz → mixer "top": lascia null)
alcolTot = Σ oz alcol
se lungo:  alcol ×a;  allungo.oz += (1−a)·alcolTot  (min 0; se allungo.oz null resta null)
se corto:  alcol, sweet, sour ×a;  se a < 1 aggiungi riga { raw:'Soda', type:'soda', oz: volumePrima − volumeDopo, text:'top di soda', added:true }
poi ogni oz × portion.  drink.alcoholic === 'no' → strength ignorata
```

- [ ] **Step 1: Test che falliscono**

```js
test('margarita normale ×1 invariata', ...);
test('margarita leggero: tequila 1.05, triple sec 0.35, lime 0.7, top soda = volume perso', ...);
test('gin tonic leggero: gin ×0.7, tonica +0.3×gin', ...);
test('forte su long: mixer ridotto, mai negativo', ...);
test('mezza porzione dimezza tutto', ...);
test('mocktail ignora strength', ...);
test('feasible: resta 0.6 oz tequila → solo {0.5,leggero}', () => {
  assert.deepEqual(feasible(idx, margarita, availWith({ tequila: 0.6, ... })), [{ portion: 0.5, strength: 'leggero' }]);
});
test('feasible con sostituzione usa la bottiglia sostitutiva e la sua dose', ...);
test('usage salta righe null e sceglie la fonte con pickSource', ...);
```

- [ ] **Step 2–4:** FAIL → implementa → PASS.
- [ ] **Step 5: Commit** `feat: dosi, intensità e combinazioni fattibili`

---

### Task 7: Shell UI, lista drink, scheda drink

**Files:**
- Create: `index.html`, `styles.css`, `js/app.js`, `js/ui/drinks.js`, `js/ui/card.js`

**Interfaces:**
- Consumes: tutto quanto sopra.
- Produces: `state` in `app.js` = `{ idx, catalog, recipes, pantry, off, settings }`; `render()`; `navigate(tab: 'drinks'|'pantry'|'recipes'|'settings')`; `openCard(drinkId, sub?)`; `persist(key)` (wrappa `store.set` e mostra l'avviso una sola volta se torna false).

- [ ] **Step 1: Shell.** Nav in basso: 🍸 Drink, 🧴 Dispensa, 📒 Le mie ricette, ⚙️ Impostazioni. Token colore su `:root` con dark mode. Al primo avvio senza `br.catalog`: schermata "Scarico il catalogo…" con avanzamento. In caso di errore: "Impossibile scaricare il catalogo" + "Riprova".
- [ ] **Step 2: Vista Drink** (layout B, mockup `layout-v2.html` + `layout-v3.html`). Sinistra: "Stasera uso" con un toggle per ogni voce della dispensa raggruppata per categoria, + "Riaccendi tutto". Destra: input "Consigliami" (disabilitato fino a Task 9), segmento Tutti/Cocktail/Mocktail (`optional` compare in entrambi), ricerca per nome. Senza ricerca: griglia ok + miss1. Con ricerca: tutto il catalogo che corrisponde, badge grigio "mancano N" per missN. Badge: verde "ok", rosso "manca: X" / "manca: X (spento)" / "poco X", blu "analcolico".
- [ ] **Step 3: Scheda drink.** Foto, segmenti porzioni / intensità (nascosta per mocktail) / unità (default da `settings.unit` = `'oz'`). Le combinazioni non in `feasible` sono disabilitate. All'apertura seleziona `{1, normale}` se fattibile, altrimenti la fattibile più grande. Ingredienti con barra di livello (oz rimaste / 25 oz, cap 100%; < 2 oz → barra rossa + "quasi finita"). Procedimento. Bottone "Fatto!": `consume` + persist + re-render, disabilitato subito al tocco. Se lo stato è miss/low e non c'è una sostituzione attiva, "Fatto!" è disabilitato. Accanto a ogni ingrediente mancante: tasto "Alternativa" (Task 9).
- [ ] **Step 4: Verifica manuale.** `python3 -m http.server 8000`, apri `http://localhost:8000`. Aggiungi tequila 0.6 oz, triple sec e lime via console (`state.pantry`) → la Margarita mostra solo "½ + Leggero". "Fatto!" → tequila sparisce dalla dispensa, la Margarita va in miss1 "manca: Tequila". Spegni il gin → il Gin Tonic mostra "manca: Gin (spento)". Prova a 768px di larghezza: nessuno scroll orizzontale.
- [ ] **Step 5: Commit** `feat: vista drink e scheda`

---

### Task 8: Dispensa, impostazioni, export/import

**Files:**
- Create: `js/ui/pantry.js`, `js/ui/settings.js`, `js/backup.js`
- Test: `tests/backup.test.js`

**Interfaces:**
- Produces: `exportData(state) -> { app:'barrecipes', version: 1, pantry, recipes, settings }` (senza chiave); `parseImport(text: string) -> { ok: true, data } | { ok: false, error: string }`

- [ ] **Step 1: Test che falliscono**

```js
test('export non contiene la chiave Gemini', ...);
test('roundtrip export → parseImport', ...);
test('rifiuta JSON non valido, app diversa, version sconosciuta, items non oggetto, oz negativo o non numerico, recipes non array', ...);
```

- [ ] **Step 2–4:** FAIL → implementa `backup.js` → PASS.
- [ ] **Step 5: Vista Dispensa.** Ricerca tipo (tutti i tipi noti + `x:`) → aggiungi. Per ogni voce: quantità opzionale con input in unità a scelta (oz/ml/cl → salvata in oz), rimozione. Raggruppata per categoria.
- [ ] **Step 6: Vista Impostazioni.** Unità default. Toggle base sempre disponibile. Chiave Gemini (input password) + guida: "Crea la chiave su aistudio.google.com in un progetto **senza fatturazione**: così non paghi mai nulla." Modello (default `gemini-2.5-flash`, modificabile). "Aggiorna catalogo" (sostituisce la cache solo se ha successo). "Esporta" (download `barrecipes-YYYY-MM-DD.json`). "Importa" (file → `parseImport` → conferma "Sostituire dispensa e ricette attuali?" → scrivi).
- [ ] **Step 7: Verifica manuale.** Esporta, svuota, importa → dati identici. Importa un file `{}` → errore, dati invariati.
- [ ] **Step 8: Commit** `feat: dispensa, impostazioni, backup`

---

### Task 9: Gemini: alternativa e consigliami

**Files:**
- Create: `js/gemini.js`
- Modify: `js/ui/card.js`, `js/ui/drinks.js`
- Test: `tests/gemini.test.js`

**Interfaces:**
- Produces:
  - `callGemini({ key, model, parts, schema, fetchFn = fetch }) -> Promise<unknown>`: POST `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, header `x-goog-api-key`, `generationConfig: { responseMimeType: 'application/json', responseSchema: schema }`. Legge `candidates[0].content.parts[0].text` e fa `JSON.parse`. Lancia `GeminiError` con un messaggio in italiano su HTTP !ok (429 → "Limite gratuito raggiunto, riprova più tardi"), testo mancante o JSON invalido.
  - `alternativePrompt(drinkName, missingName, pantryNames) -> parts`; `validateAlternatives(json, idx) -> { type, name, oz: number|null, note }[]` (scarta le voci senza nome, risolve `name` → tipo con `resolveType`, max 3)
  - `recommendPrompt(query, compact: { id, name, types: string[], alcoholic }[]) -> parts`; `validateRecommend(json, ids: Set<string>) -> { picks: { id, why }[], external: { name, why }[] }` (scarta id sconosciuti, max 5)

- [ ] **Step 1: Test che falliscono**

```js
test('callGemini: 429 → GeminiError limite', ...);
test('callGemini: testo non JSON → GeminiError "Risposta non valida, riprova"', ...);
test('validateRecommend scarta id inventati', () => assert.deepEqual(validateRecommend({ picks: [{ id: 'cdb:1', why: 'x' }, { id: 'boh', why: 'y' }] }, new Set(['cdb:1'])).picks, [{ id: 'cdb:1', why: 'x' }]));
test('validateRecommend tollera campi mancanti', ...);
test('validateAlternatives risolve tipi e taglia a 3', ...);
```

- [ ] **Step 2–4:** FAIL → implementa → PASS.
- [ ] **Step 5: Alternativa in scheda.** Tasto "Alternativa" su un ingrediente mancante. Prima mostra i `siblings` disponibili (senza chiamata). Poi "Chiedi a Gemini" (chiave assente → messaggio + link alle Impostazioni). Ogni proposta ha "Usa questa": imposta `sub = { from, to, oz }` nello stato locale della scheda, ricalcola `computeDose`/`feasible` e abilita "Fatto!". `usage` scala `to`. `sub` sparisce alla chiusura della scheda.
- [ ] **Step 6: Consigliami.** Invia la query + la lista compatta dei drink ok/miss1 (filtro cocktail/mocktail applicato). Mostra le card dei `picks` con il "perché" in testa alla griglia, più gli `external` come card "da provare" senza scheda. Ci sono uno spinner e la gestione degli errori.
- [ ] **Step 7: Verifica manuale** con una chiave vera: "fruttato con tequila" con tequila + succo d'arancia + granatina in dispensa → compare Tequila Sunrise.
- [ ] **Step 8: Commit** `feat: alternativa e consigliami con Gemini`

---

### Task 10: Ricette personali (manuali + YouTube)

**Files:**
- Create: `js/ui/recipes.js`
- Modify: `js/gemini.js`, `js/app.js` (catalogo unito = `catalog.drinks ∪ recipes`)
- Test: `tests/gemini.test.js` (aggiunte), `tests/recipes.test.js`

**Interfaces:**
- Produces: `youtubeParts(url) -> parts` (`[{ file_data: { file_uri: url } }, { text: prompt }]`); `isYoutubeUrl(s) -> boolean` (`youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/`); `validateExtracted(json, idx) -> Drink[]` (id `my:<timestamp>-<i>`, `source:'youtube'`, `url`, ingredienti con `resolveType`, oz numerico o null, scarta drink senza nome o senza ingredienti); `newRecipe(fields) -> Drink` (id `my:<timestamp>`, `source:'manual'`)

- [ ] **Step 1: Test che falliscono**

```js
test('isYoutubeUrl', ...);
test('validateExtracted: più drink, tipi risolti, scarta vuoti', ...);
test('newRecipe genera id my: e source manual', ...);
```

- [ ] **Step 2–4:** FAIL → implementa → PASS.
- [ ] **Step 5: Vista "Le mie ricette".** Lista + "Nuova ricetta" + "Da YouTube". Form: nome, analcolico sì/no, righe ingrediente (tipo da ricerca + quantità + unità, oppure testo libero), procedimento. Modifica ed eliminazione (con conferma). Da YouTube: URL valido → conferma "Analizzo il video con Gemini (conta sul limite gratuito giornaliero). Procedo?" → spinner → anteprima modificabile di ogni drink estratto nel form → "Salva". Il prompt chiede: nomi degli ingredienti presi dalla lista dei tipi (passata nel prompt), dosi in oz, procedimento in italiano.
- [ ] **Step 6: Verifica manuale.** Una ricetta manuale compare nella griglia con i badge corretti. Prova un video YouTube pubblico di un canale di cocktail.
- [ ] **Step 7: Commit** `feat: ricette personali e import da YouTube`

---

### Task 11: PWA e pubblicazione

**Files:**
- Create: `manifest.webmanifest`, `sw.js`, `icon.svg`, `README.md`
- Modify: `index.html` (link manifest, registrazione SW)

- [ ] **Step 1:** Manifest con `name: "BarRecipes"`, `display: "standalone"`, `orientation: "landscape"`, icona SVG. Service worker cache-first per gli asset dell'app (lista esplicita, versione nel nome cache). Rete per API e immagini.
- [ ] **Step 2: Verifica manuale.** DevTools → Application: manifest valido, SW attivo. In modalità offline, ricarica: l'app parte con catalogo e dispensa. Le foto mancanti mostrano un placeholder.
- [ ] **Step 3:** `README.md` con: avvio locale (`python3 -m http.server`), test (`npm test`), pubblicazione gratis su GitHub Pages (push del repo → Settings → Pages → branch `main`, root), installazione su tablet ("Aggiungi a schermata Home"), creazione della chiave Gemini senza fatturazione.
- [ ] **Step 4: Commit** `feat: PWA e istruzioni`
