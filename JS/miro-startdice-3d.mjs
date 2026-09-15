import { createDice3D } from "./jagd-dice-3d.mjs?v=1";

// Miros Startwurf nutzt denselben 3D-Würfel und dieselbe Würfellogik wie
// Mirelons Jagd (keine zweite 3D-Erzeugung) - nur eine eigene, zweite
// Instanz für den eigenen Button/Canvas.
const shell = document.getElementById("miro-startdice-btn");
if (shell) {
    window.MiroStartDice3D = createDice3D(shell, document.getElementById("miro-startdice-face"));
}
