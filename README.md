# BarRecipes

Ricettario di drink per tablet: mostra i drink che puoi fare con la tua dispensa, scala le dosi dalle bottiglie e usa Gemini per alternative, consigli e ricette da YouTube.

Webapp statica (HTML/CSS/JS, nessun build, nessun backend). I dati restano nel browser del dispositivo.

## Avvio locale

```bash
python3 -m http.server 8000
```

Poi apri http://localhost:8000. Al primo avvio scarica il catalogo di TheCocktailDB (circa 30 secondi).

## Test

Serve Node 20 o superiore, senza dipendenze da installare.

```bash
npm test
```

## Pubblicazione gratuita (GitHub Pages)

1. Crea un repository su GitHub e fai il push del branch `main`.
2. Nel repository apri **Settings → Pages**.
3. Scegli **Deploy from a branch**, branch `main`, cartella `/ (root)`.
4. Dopo un minuto l'app è su `https://<utente>.github.io/<repository>/`.

Funziona anche Cloudflare Pages, sempre senza build: output directory `/`.

## Installazione sul tablet

Apri l'indirizzo pubblicato e scegli **Aggiungi a schermata Home** (Safari) oppure **Installa app** (Chrome). Si apre a schermo intero e funziona anche offline. Gemini e il download del catalogo richiedono la rete.

## Chiave Gemini (gratis)

1. Vai su https://aistudio.google.com/apikey.
2. Crea la chiave in un progetto Google Cloud **senza fatturazione attiva**. In questo modo non paghi mai nulla: superato il limite gratuito, Gemini risponde "limite raggiunto" invece di addebitare.
3. Incollala in **Impostazioni → Gemini** nell'app. Resta solo su quel dispositivo e non finisce nei backup.

Se il modello predefinito (`gemini-2.5-flash`) non è più disponibile, cambialo nelle Impostazioni con un modello Flash gratuito attuale.

## Backup

**Impostazioni → Backup → Esporta** salva dispensa, ricette personali e preferenze in un file JSON. **Importa** lo ripristina (sostituisce i dati attuali).

## Struttura

- `js/` contiene la logica pura (misure, tipi, match, dosi, backup, Gemini), testata in `tests/`.
- `js/ui/` contiene le viste.
- `data/types.json` converte gli ingredienti di TheCocktailDB in tipi generici italiani. Si aggiorna con `node scripts/ingredient-freq.js`, che mostra gli ingredienti più usati.
- Spec e piano di sviluppo sono in `docs/superpowers/`.
