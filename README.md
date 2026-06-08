# Punkty idealne posłów Sejmu — strona

Statyczna wizualizacja (GitHub Pages) głównej osi podziału posłów Sejmu X kadencji,
odtworzonej z głosowań imiennych (model przestrzenny / MCMC). Czysty HTML/JS, bez backendu.

## Pliki
- `index.html`, `style.css`, `app.js` — strona (D3)
- `ideal_points.json` — pozycje + statystyki per poseł
- `votes.json`, `mp_votes.json`, `model_params.json` — dane do historii głosowań i rozkładów

## Publikacja (GitHub Pages)
Settings → Pages → Build and deployment → Source: **Deploy from a branch**,
branch `main`, folder **/(root)**. Strona pod `https://psephos-lab.github.io/<repo>/`.

## Podgląd lokalny
```bash
python3 -m http.server 8000   # otwórz http://localhost:8000
```
Kod modelu i dane źródłowe: osobne repo z projektem.
