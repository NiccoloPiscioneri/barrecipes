# BarRecipes: design

Data: 2026-10-22. Stato: bozza da approvare.

## Intento

Ricettario di drink personale, usato dal proprietario sul proprio tablet, sia per un drink veloce sia durante serate con amici. Risponde a una domanda: "cosa posso fare adesso con quello che ho?". Mostra i drink possibili in base alla dispensa reale (bottiglie e quantità rimaste), aiuta con le alternative quando manca qualcosa e suggerisce drink da una richiesta libera.

## Vincoli

- **Budget 0.** Solo servizi gratuiti: API, hosting, AI. Nessun backend a pagamento.
- **Un solo dispositivo:** tablet, in orizzontale. Nessuna sincronizzazione. Il backup si fa con export/import di un file.
- **Lingua UI:** italiano.
- **Ingredienti per tipo, mai per marca:** "Tequila", "Rum bianco", "Gin". Mai "Bacardi".

## Obiettivi

1. Catalogo drink da TheCocktailDB, unito alle ricette personali.
2. Filtro in base alla dispensa: drink possibili, drink con 1 ingrediente mancante (badge rosso), gli altri nascosti.
3. Dispensa con livello delle bottiglie, che si scala quando si prepara un drink.
4. Interruttori "Stasera uso" per escludere ingredienti solo per il momento.
5. Dosi: porzioni, intensità (Leggero/Normale/Forte), unità di misura (oz di default).
6. Gemini: alternativa a un ingrediente mancante, consigli da frase libera, estrazione di ricette da un video YouTube.
7. Ricette personali scritte a mano o estratte da YouTube.
8. Filtro Tutti / Cocktail / Mocktail.
9. Export/import JSON di dispensa e ricette personali.

## Non-obiettivi

- Account, login, sincronizzazione tra dispositivi.
- Gestione per marca.
- Lista della spesa, statistiche, condivisione social.
- Layout ottimizzato per telefono. Deve restare usabile, ma il target è il tablet.

## Anti-obiettivi (fallimento anche se "funziona")

- Costi imprevisti di qualsiasi tipo.
- Gemini che inventa drink inesistenti nei consigli, se non segnalati esplicitamente come "da provare".
- Dosi Leggero/Forte che sbilanciano il drink.
- Un drink proposto come fattibile quando una bottiglia non basta.

## Decisioni del proprietario

- Webapp su tablet. Tecnologie a scelta del builder, budget 0.
- Ingrediente mancante: il drink resta visibile con un badge rosso. Un tasto chiede a Gemini un'alternativa usando la dispensa.
- Dispensa solo sul tablet, con export/import.
- Ricette personali scritte a mano o estratte da un link YouTube tramite Gemini, anche più drink da un solo video.
- Ingredienti per tipo, non per marca.
- "Consigliami": frase libera ("fruttato con tequila"), Gemini propone drink. Esempio atteso: Tequila Sunrise.
- Layout B: pannello a sinistra e griglia dei drink a destra. Mockup in `.superpowers/brainstorm/`: `layout-v2.html` per il pannello "Stasera uso", `layout-v3.html` per griglia e scheda drink.
- Il pannello sinistro **non** è l'editor della dispensa. Elenca gli ingredienti posseduti come interruttori temporanei ("Stasera uso"), con un tasto "Riaccendi tutto". La dispensa si modifica nella sua pagina.
- Tracciamento delle bottiglie con dosi scalabili. Possibilità di mezza dose.
- Selezione dei mocktail.
- Intensità Leggero/Forte senza sbilanciare.
- Once come unità di default.
- **Blocco per quantità insufficiente:** se una bottiglia non basta, le combinazioni porzione/intensità che la superano sono disabilitate. Viene proposta la combinazione massima fattibile. Esempio: resta ½ oz, quindi solo "½ porzione" o "½ porzione + Leggero".
- **Bottiglia a 0:** viene eliminata dalla dispensa.

## Scelte del designer (Claude), correggibili

### Stack
- Webapp statica in HTML/CSS/JS, senza backend. Installabile come PWA (manifest + service worker per l'uso offline del catalogo).
- Hosting gratuito su GitHub Pages o Cloudflare Pages.
- Dati locali in IndexedDB (o localStorage se basta): dispensa, ricette personali, cache del catalogo, impostazioni.

### TheCocktailDB
- Chiave gratuita `1`: `https://www.thecocktaildb.com/api/json/v1/1/`.
- La chiave gratuita **non** filtra per più ingredienti. Inoltre `list.php?i=list` restituisce solo 100 ingredienti (verificato). Si scarica quindi tutto il catalogo con `search.php?f=<a-z,0-9>` e si salva in cache locale, con un tasto "Aggiorna catalogo" nelle impostazioni. Gli ingredienti si ricavano dal catalogo stesso.
- Campi utili (verificati): `strIngredient1..15`, `strMeasure1..15` (es. `"1 1/2 oz "`), `strInstructionsIT` (spesso presente, altrimenti si usa `strInstructions`), `strAlcoholic` (`Alcoholic` / `Non alcoholic` / `Optional alcohol`), `strDrinkThumb`.
- Mocktail = `Non alcoholic`. `Optional alcohol` compare in entrambi i filtri.

### Tipi di ingrediente
- Tabella di conversione statica (file JSON nel repo) dai nomi di TheCocktailDB a tipi generici in italiano. Esempi: `Light rum`, `White rum`, `Bacardi` → Rum bianco. `Absolut Citron` → Vodka. `Lime juice` → Succo di lime.
- Un tipo generico nella ricetta ("Rum") è soddisfatto da qualsiasi sottotipo posseduto (Rum bianco, Rum scuro). Serve una piccola gerarchia padre/figlio nella tabella.
- I prodotti che definiscono un drink diventano tipi generici con nome descrittivo, figli di un gruppo. Esempio: `Campari` → Bitter rosso, `Aperol` → Bitter arancio, entrambi sotto "Bitter da aperitivo". I fratelli non si soddisfano a vicenda in automatico (gusto e gradazione diversi), ma sono la prima proposta di alternativa.
- Gli ingredienti non presenti nella tabella mantengono il nome originale e possono comunque essere aggiunti alla dispensa.
- Ogni tipo ha una categoria (Alcolici, Liquori, Sciroppi, Soda/Mixer, Succhi, Frutta/Erbe, Base) per raggruppare la dispensa.
- **Base sempre disponibile:** ghiaccio, acqua, zucchero, sale. Non bloccano mai un drink e si possono disattivare dalle impostazioni.

### Dispensa e bottiglie
- Ogni voce ha: tipo, e opzionalmente una quantità rimasta in oz (inserita anche in ml/cl).
- Le voci senza quantità (lime, menta, ingredienti base) contano solo come presenti/assenti e non vengono scalate.
- "Fatto!" nella scheda del drink scala le dosi effettive (porzione × intensità) dalle voci con quantità. Quando una voce arriva a ≤ 0, viene eliminata dalla dispensa.
- Barra di livello visibile nella scheda del drink. Avviso quando una bottiglia è quasi vuota (soglia del builder, ad es. < 2 oz).
- Un drink la cui dose minima fattibile (½ porzione + Leggero) supera la quantità rimasta conta come "manca ingrediente", con il badge "poco <ingrediente>".
- Misure senza volume interpretabile (vuota, `top`, `Juice of 1`, testo libero): contano solo come presenza. Non bloccano per quantità e non vengono scalate. `dash` = 1/32 oz e `splash` = ¼ oz vengono invece scalati.
- Se più sottotipi soddisfano un tipo generico ("Rum" → Rum bianco o Rum scuro), si scala quello con più quantità rimasta.

### Interruttori "Stasera uso"
- Uno stato temporaneo che non modifica la dispensa. Durata: finché non si preme "Riaccendi tutto". Sopravvive al refresh della pagina.
- Un ingrediente spento conta come mancante, con il badge "manca: X (spento)".

### Dosi
- Porzioni: ½, 1, 2, 3, 4.
- Unità: oz (default), ml, cl. 1 oz = 30 ml, arrotondato a ¼ oz o 5 ml.
- Parser per `strMeasure`: frazioni (`1 1/2`), `oz`, `cl`, `ml`, `shot` (1,5 oz), `tsp`, `tblsp`, `dash`, `splash`, `top`, testo libero (`Juice of 1`). Le misure che non si possono interpretare vengono mostrate come testo e non scalate in volume (moltiplicate solo come conteggio quando possibile).
- **Intensità**, calcolata dall'app senza Gemini:
  - Leggero: alcolici ≈ -30%. Forte: alcolici ≈ +25%.
  - Long drink (presenza di un mixer da top: soda, tonica, cola, ginger beer, succo come allungante): il mixer compensa per mantenere il volume.
  - Short drink: dolce e acido scalano insieme agli alcolici per mantenere il rapporto. Nel Leggero si aggiunge un top di soda o acqua per mantenere il volume.
  - Percentuali e classificazione dolce/acido/mixer sono a discrezione del builder, basate sulla categoria nella tabella dei tipi.
  - Mocktail: il selettore di intensità è nascosto.

### Gemini
- API Gemini, piano gratuito di Google AI Studio, chiamata direttamente dal browser.
- La chiave viene inserita dall'utente nelle impostazioni e salvata localmente. **Mai nel codice o nel repo.**
- Protezione dai costi: il browser non può sapere se il progetto Google ha la fatturazione attiva. Le impostazioni mostrano una breve guida: "crea la chiave in AI Studio su un progetto **senza** fatturazione". L'estrazione da YouTube chiede conferma prima di partire.
- Modello: un modello Flash gratuito attuale (scelta del builder).
- Le funzioni Gemini sono disattivate con un messaggio chiaro se la chiave manca.
- **Alternativa:** input = drink, ingrediente mancante, tipi in dispensa (attivi). Output = 1-3 sostituti, preferibilmente dalla dispensa, con eventuale aggiustamento della dose.
  - Ogni sostituto ha un tasto **"Usa questa"** (decisione del proprietario). La scheda del drink mostra la ricetta con il sostituto e la sua dose, e "Fatto!" scala la bottiglia sostitutiva. Il blocco per quantità e la combinazione massima fattibile valgono anche per il sostituto.
  - La sostituzione vale solo finché la scheda è aperta e non modifica la ricetta salvata. Il drink resta in lista con il badge rosso.
  - Prima di chiamare Gemini, l'app propone i "fratelli" nella tabella dei tipi (es. Bitter arancio per Bitter rosso), se sono in dispensa.
- **Consigliami:** input = frase + elenco compatto (id, nome, tipi di ingrediente, alcolico sì/no) dei drink fattibili e con 1 mancante. Output JSON = 3-5 id dal catalogo con una riga di motivazione ciascuno. Se nulla è adatto, si può proporre un drink esterno segnato come "da provare". Gli id restituiti vengono validati contro il catalogo.
- **Da YouTube:** il link viene passato come `file_data.file_uri` (funziona solo con video pubblici; il piano gratuito ha un limite giornaliero di ore di video). Output JSON = uno o più drink con nome, ingredienti (con i nomi dei tipi della dispensa), dosi in oz, procedimento in italiano, alcolico sì/no. Prima del salvataggio viene mostrata un'anteprima modificabile.

### Ricette personali
- Stessa struttura dei drink del catalogo, con un campo origine (`manuale` / `youtube` + URL).
- Form per inserimento e modifica manuale. Gli ingredienti si scelgono dai tipi.
- Compaiono nella griglia insieme al catalogo, con lo stesso filtro e gli stessi badge, e hanno una pagina "Le mie ricette".

### Export/import
- Un solo file JSON con versione dello schema: dispensa, ricette personali, impostazioni (esclusa la chiave Gemini).
- Import: sostituisce i dati attuali dopo una conferma. Il file viene validato prima di essere scritto.

### Navigazione
- Barra in basso: Drink, Dispensa, Le mie ricette, Impostazioni.
- Drink: pannello "Stasera uso" a sinistra. A destra: box "Consigliami", filtro Tutti/Cocktail/Mocktail, ricerca per nome, griglia con i fattibili prima e quelli con 1 mancante dopo.
- La **ricerca per nome** copre tutto il catalogo. I drink con 2 o più mancanti compaiono solo nei risultati di ricerca, con il badge grigio "mancano N". Così si può sempre consultare una ricetta. "Consigliami" resta limitato ai fattibili e a quelli con 1 mancante.
- Tocco su un drink: scheda con foto, porzioni, intensità, unità, ingredienti con barre di livello, procedimento, "Fatto!", e "Alternativa" accanto a ogni ingrediente mancante.

## Lasciato al builder

- Framework (anche nessuno), struttura dei file, stile visivo.
- Contenuto completo della tabella dei tipi (partendo dagli ingredienti più frequenti nel catalogo).
- Prompt Gemini, modello esatto, gestione degli errori e dei limiti di frequenza.
- Soglie numeriche (avviso bottiglia quasi vuota, percentuali di intensità, arrotondamenti).
