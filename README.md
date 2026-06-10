# Punkty idealne posłów Sejmu RP

**Interaktywna mapa pozycji posłów Sejmu na głównej osi podziału**,
odtworzonej wyłącznie z głosowań imiennych — bez przypisywania partiom etykiet ideologicznych.
Dostępne **sześć kadencji** (przełącznik u góry): od **V (2005–2007)** do **X (od 2023)**.

🔗 **Strona na żywo:** https://psephos-lab.github.io/sejm-ideal-points-site/

## Co tu znajdziesz

- **Przełącznik kadencji** — sześć kadencji od V (2005–2007) do X (od 2023); każda liczona osobnym modelem.
- **Mapa izby** — każdy poseł jako punkt na osi, kolorowany klubem; wyszukiwarka i filtr klubów.
- **Profil posła** (po kliknięciu) — pozycja z przedziałem ufności, ranga, frekwencja,
  lojalność klubowa, rozkład całej izby na tle posła, najbliżsi pozycją.
- **Historia głosowań** — chronologiczna lista ustaw: jak głosował poseł, jak klub, wynik, link do PDF.
- **Rozkład głosów** dla każdej ustawy — gdzie na osi leżeli głosujący „za" i „przeciw"
  (w stylu Voteview), z krzywą modelową dla głosowań spornych.

## Jak to czytać

Pozioma oś to **główna oś podziału** wyłaniająca się z wzorców „za/przeciw" — posłowie głosujący
podobnie leżą blisko siebie. Znak (±) jest umowny. Oś najprawdopodobniej odpowiada podziałowi
**rząd–opozycja**; celowo **nie** nazywamy jej „lewica–prawica", bo to wymagałoby przypisania
partiom ideologii, czego same głosowania nie rozstrzygają. „Punkt idealny" to pozycja w przestrzeni
głosowań, **nie** ocena polityka. Niepewność rośnie dla posłów głosujących rzadko.

## Metoda i dane

Bayesowski model przestrzenny (2-parametrowy IRT, probit), estymacja MCMC (sampler Gibbsa
z augmentacją Alberta-Chiba). Dane: głosowania imienne z [api.sejm.gov.pl](https://api.sejm.gov.pl).

**Kod modelu, dane źródłowe i opis metody:** https://github.com/psephos-lab/sejm-ideal-points-model

## Pliki

- `index.html`, `style.css`, `app.js` — strona (D3.js, bez backendu i build-stepu)
- `ideal_points.json` — pozycje + statystyki per poseł
- `votes.json`, `mp_votes.json`, `model_params.json` — dane do historii i rozkładów głosowań

## Podgląd lokalny

```bash
python3 -m http.server 8000   # http://localhost:8000
```

Otwarcie `index.html` bezpośrednio z dysku (`file://`) nie zadziała — przeglądarka blokuje
wczytywanie danych JSON z tego protokołu. Potrzebny jest serwer HTTP (lub GitHub Pages).
