# Neste steg

- [ ] Skill på ulike typer seier slik at man har noe å strekke seg etter, samtidig som man kan ha gleden av å vinne litt
  - Komplett seier: begge brikkene slapp ut uten å jukse
  - Delvis seier: én brikke slapp ut uten å jukse
  - Komplett seier med juks: begge brikkene slapp ut, men man jukset (antall regler brutt er en ytterligere gradering)
  - Delvis seier med juks: én brikke slapp ut med juks (antall regler brutt er en ytterligere gradering)
  - Tap: begge brikkene ble tatt
- [ ] Juster videre på variantene, evt lage nye, for å til slutt finne den beste som så blir hovedversjonen
  - [X] Ny variant: I det man ankommer en node, så endres enveiskjøringene på de tilknyttede veiene seg.
  - [ ] Ny variant: Hver sirkel beveger seg ett hakk hver runde, i retning enveiskjøringene.
  - [ ] Ny variant: Test ut ulikt antall noder pr sirkel, slik at det vil være en gevinst å bevege seg innover for å komme raskere rundt til andre siden.
  - [X] Ny variant: Et brett hvor noen tråder er tykke (kan brukes hele tiden), og noen er tynne (de ryker etter én gangs bruk og reduserer dermed antall mulige veier). Kanskje det er sirklene som er tynne og eikene tykke? (Implementert som v7 Brente Broer: alle ringsegmenter, også ytterringen, brenner etter én bruk; eiker og hjørnelenker er tykke; både spillere, slanger og rever brenner tråder, og et revesprang brenner begge segmentene.)
- [ ] En Power som er å kunne kutte én tråd i løpet av spillet.
- [ ] kan teste at slangene ikke MÅ flytte tre steg, og at revene ikke MÅ bruke to hopp
- [X] Juster UI, man bør kunne nå knappene for terning og avslutt tur uten å scrolle vekk fra brettet. Kanskje fjern eller flytt noe forklaring.
- [X] Man bør kunne se hvilke fiendebrikker som er i en stack (på både desktop og mobil), slik at man vet om det er bare rever, bare slanger, eller begge deler.
- [X] Kollaps Powers under én knapp
- [ ] Nå velges den fienden som er nærmest en spiller (og som ikke har beveget seg denne runden), uavhengig av om den vil være i stand til å fange spilleren. Lag en knapp som skifter mellom dét og at det heller velges den fienden med størst sannsynlighet for å greie å fange en spiller.
