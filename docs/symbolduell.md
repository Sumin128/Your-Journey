# Mirelons Symbolduell

Mirelons Symbolduell ist ein eigenes Reaktionsspiel in Tessas Hasenschule. Zwei Karten zeigen jeweils acht Symbole. Zwischen zwei beliebigen Karten existiert immer genau ein gemeinsames Symbol. Wer es zuerst findet, erhält den Punkt; acht Punkte gewinnen die Partie.

## Kartensatz

- 57 eigene Mirelon-Symbole
- 57 mathematisch erzeugte Karten
- exakt 8 verschiedene Symbole pro Karte
- exakt 1 gemeinsames Symbol zwischen jedem Kartenpaar
- 1.596 Kartenpaare werden von der Laufzeitprüfung kontrolliert

Der Kartensatz basiert auf der projektiven Ebene der Ordnung 7. Die Karten werden in `JS/symbolduell.js` erzeugt und vor Spielbeginn vollständig validiert. Dadurch ist die Ein-Treffer-Regel nicht vom Zufall abhängig.

## Spielablauf

- Der Spieler tritt gegen Tessa an.
- Tessa reagiert zufällig nach 10 bis 15 Sekunden.
- Bei einem richtigen Spielertipp werden beide Treffer hervorgehoben und der Spielerpunkt vergeben.
- Bei einem falschen Tipp bleibt die Runde aktiv.
- Wenn Tessa den Treffer findet, werden erst beide Symbole markiert und benannt; danach erhält sie ihren Punkt.
- Nur ein vollständiger Spielersieg vergibt 25 XP (`symbolduell_gewonnen`). Die serverseitige Regel liegt in `game_xp_rules`.

## Grafiken

Die 57 fertigen, browseroptimierten Einzelgrafiken liegen in `images/symbolduell/`. Im Spiel wird der daraus erzeugte Atlas `symbole-atlas.png` geladen, damit alle Symbole mit einer einzigen Bildanfrage verfügbar sind. Die hochauflösenden transparenten Produktionsbögen liegen getrennt unter `assets-source/symbolduell/sheets/` und werden durch `.vercelignore` nicht ausgeliefert.
