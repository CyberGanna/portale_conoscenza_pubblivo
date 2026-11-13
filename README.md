# Portale della conoscenza

App personale per esplorare concetti, tradurre parole e fare quiz, con AI gratuita (Groq, modelli open source; riserve OpenRouter e Ollama).

- Si apre su GitHub Pages: le chiavi AI e le voci restano solo nel browser di chi la usa.
- Per spostare le voci tra dispositivi: ⚙ → Esporta / Importa archivio.

## Mia Dashboard

La dashboard personale di Karim, nella cartella [`dashboard/`](dashboard/): si apre su
https://cyberganna.github.io/portale_conoscenza_pubblivo/dashboard/ e si installa come app su iPhone (Safari → Condividi → Aggiungi alla schermata Home) e su PC (Chrome o Edge → Installa).

### Notizie della dashboard

Ogni ora il workflow `.github/workflows/notizie.yml` esegue `dashboard/news/aggiorna.mjs`: legge i feed RSS delle testate (ANSA, Il Post, Il Sole 24 Ore, BBC, Guardian, Reuters e AP tramite Google News, siti di tecnologia, sicurezza informatica e clima), raggruppa gli articoli sullo stesso fatto, li classifica per categoria e paese e salva `news.json` nel ramo `notizie`. La dashboard lo legge da lì. Per aggiungere o togliere fonti si modifica l'elenco `FEEDS` nello script. Il riassunto AI usa la chiave Groq gratuita già salvata nel portale.
