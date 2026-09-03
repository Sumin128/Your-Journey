/* =====================================================
   FARO – TIERSPUREN (gemeinsame SVG-Abdrücke)
   Genutzt von faro-faehrten.js (Fährten lesen) und
   faro-memory.js (Fährten-Memory).

   viewBox 0 0 100 120, Füllung über currentColor.
   Wer echte gemalte Spurenbilder hat, kann die Einträge
   durch <img>-Markup ersetzen - beide Spiele nutzen sie
   nur als HTML-String.
   ===================================================== */

window.FARO_TRACKS = {

    hund:
        '<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" fill="currentColor">' +
        '<ellipse cx="28" cy="46" rx="10" ry="15"/>' +
        '<ellipse cx="44" cy="32" rx="10" ry="16"/>' +
        '<ellipse cx="60" cy="32" rx="10" ry="16"/>' +
        '<ellipse cx="76" cy="46" rx="10" ry="15"/>' +
        '<path d="M22 78 Q50 52 78 78 Q84 104 50 108 Q16 104 22 78 Z"/>' +
        '<circle cx="24" cy="26" r="3"/><circle cx="42" cy="12" r="3"/>' +
        '<circle cx="62" cy="12" r="3"/><circle cx="80" cy="26" r="3"/>' +
        '</svg>',

    katze:
        '<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" fill="currentColor">' +
        '<ellipse cx="31" cy="48" rx="9" ry="12"/>' +
        '<ellipse cx="45" cy="38" rx="9" ry="13"/>' +
        '<ellipse cx="59" cy="38" rx="9" ry="13"/>' +
        '<ellipse cx="72" cy="48" rx="9" ry="12"/>' +
        '<path d="M26 74 Q50 54 74 74 Q82 100 50 104 Q18 100 26 74 Z"/>' +
        '</svg>',

    reh:
        '<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" fill="currentColor">' +
        '<path d="M47 16 C 34 20, 28 48, 34 82 C 37 100, 45 108, 47 108 C 48 90, 48 40, 47 16 Z"/>' +
        '<path d="M53 16 C 66 20, 72 48, 66 82 C 63 100, 55 108, 53 108 C 52 90, 52 40, 53 16 Z"/>' +
        '</svg>',

    baer:
        '<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" fill="currentColor">' +
        '<path d="M16 66 Q50 40 84 66 Q90 100 50 104 Q10 100 16 66 Z"/>' +
        '<ellipse cx="22" cy="50" rx="8" ry="11"/>' +
        '<ellipse cx="37" cy="40" rx="8" ry="12"/>' +
        '<ellipse cx="52" cy="36" rx="8" ry="12"/>' +
        '<ellipse cx="67" cy="40" rx="8" ry="12"/>' +
        '<ellipse cx="81" cy="50" rx="8" ry="11"/>' +
        '<path d="M20 34 l4 8 l4 -8 Z"/><path d="M35 24 l4 8 l4 -8 Z"/>' +
        '<path d="M50 20 l4 8 l4 -8 Z"/><path d="M65 24 l4 8 l4 -8 Z"/>' +
        '<path d="M79 34 l4 8 l4 -8 Z"/>' +
        '</svg>',

    vogel:
        '<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round">' +
        '<path d="M50 66 L28 20"/>' +
        '<path d="M50 66 L50 12"/>' +
        '<path d="M50 66 L72 20"/>' +
        '<path d="M50 66 L50 106"/>' +
        '</svg>',

    ente:
        '<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" fill="currentColor">' +
        '<path d="M50 84 L24 26 Q37 34 50 22 Q63 34 76 26 Z"/>' +
        '<rect x="46" y="80" width="8" height="26" rx="4"/>' +
        '</svg>'
};

window.FARO_TRACK_NAMES = {
    hund: "Hund",
    katze: "Katze",
    reh: "Reh",
    baer: "Bär",
    vogel: "Vogel",
    ente: "Ente"
};
