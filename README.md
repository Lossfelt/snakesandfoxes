# Snakes & Foxes

Et lite, selvstendig nettleserspill inspirert av veven med slanger og rever fra *Wheel of Time*-bøkene.

Målet er å føre to brikker fra sentrum ut til ytterringen og hjem igjen før slangene og revene tar dem. Du kan vinne med én gjenlevende brikke, og du må trolig bryte noen regler underveis.

## Regelsett

| Regelsett | Beskrivelse |
| --- | --- |
| v1 Klassisk | To vanlige terninger. Hele fiendeflokken jakter samlet. |
| v1 Tidevann | Alle slangene beveger seg hver runde, mens revene bruker to terninger. |
| v2 Symbol | Seks symbolterninger. Slanger og rever har ulik bevegelse. Dette er standardvalget. |
| v3 Sektor | Som v2, men hjemveien må gå inn fra en fjern sektor etter at brikken har nådd kanten. |
| v4 Kutt | Som v2, men veven har forskjøvne eikekutt mellom ringene. |
| v5 Villvev | Enveisretningene trekkes på nytt for hvert spill. Når bare én brikke er aktiv, bruker den den høyeste terningen. |

## Kreftene

Hver kraft kan brukes én gang per spill:

* **Mot** dobler neste kast.
* **Ild** stanser neste fiendefase.
* **Musikk** halverer fiendens fart i to runder.
* **Jern** binder én fiendebrikke for resten av spillet.
* **Vev** snur retningen på én markert enveispil for resten av spillet.

## Betjening

* Mus eller berøring: Velg og flytt brikker direkte på brettet.
* `Tab`: Flytt fokus til brettet.
* Piltaster: Naviger mellom felt.
* `Enter` eller mellomrom: Velg eller flytt.
* `Home`: Gå til sentrum.
* `Esc`: Avbryt et trygt målvalg eller lukk en dialog.

## Teknologi

Spillet er laget med:

* HTML for struktur
* CSS for layout og visuell stil
* JavaScript for spillmotor, regelsett, animasjoner og diagnostikksimuleringer
* SVG for brett, brikker, symboler og ikoner

Det brukes ingen eksterne biblioteker, npm-pakker eller backend. Tilfeldighet i spillet kan gjøres reproducerbar med en `seed`-parameter, for eksempel `/?seed=test`.

## Prosjektstruktur

```text
.
├── index.html       # Spillets brukergrensesnitt og regler
└── assets/
    ├── game.js      # Spillmotor, regelsett, simuleringer og interaksjon
    ├── game.css     # Layout, responsiv styling og animasjoner
    └── sign.svg      # Ikon for spillet
```

## Bakgrunn

Brettets geometri, fordeling, antall steg, artsbevegelser, sektorretur, eikekutt og krefter er rekonstruert som konkrete spillmekanikker for denne versjonen. Spillet er derfor en egen digital tolkning, ikke en autoritativ gjengivelse av en kanonisk brettspillregelbok.

Referansene som er oppgitt i spillet er *The Shadow Rising*, kapittel 28, *Lord of Chaos*, kapittel 22 og 33, *Knife of Dreams*, kapittel 10, samt *Towers of Midnight*.
