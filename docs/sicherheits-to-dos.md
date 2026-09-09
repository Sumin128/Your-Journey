# Sicherheits-To-dos

## Bestenliste gegen Punktespam absichern

- Status: Später umsetzen, bevor die Bestenliste als fairer Wettbewerb beworben wird.
- Ausgangslage: `increment_highscore()` erhöht den Punktestand eines angemeldeten Kontos derzeit bei jedem Aufruf um 10 Punkte. Dadurch könnte ein technisch versierter Spieler seinen Wert künstlich erhöhen.
- Ziel: Punkte nur noch nach einem serverseitig bestätigten Spielabschluss vergeben. Jede gewertete Runde braucht eine stabile Runden-ID; dieselbe Runde darf nur einmal zählen. Wo keine Runden-ID möglich ist, braucht es eine atomare Sperre beziehungsweise ein serverseitiges Cooldown.
- Zusätzlich prüfen: Spielername serverseitig begrenzen und bereinigen, bestehende Bestenlistenwerte beim Umstieg bewerten sowie alle Spiele eindeutig an die neue Wertung anbinden.
- Nicht Teil der aktuellen Aufgaben: keine Änderung an vorhandenen Punkteständen, Spielen oder der Datenbanklogik ohne eigenen Test- und Umsetzungsdurchgang.
