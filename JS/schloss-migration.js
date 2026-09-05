/* =====================================================
   SCHLOSS-MIGRATION.JS
   Wandelt alte 2D-Platzierungen ({x, y, flipped}, normiert 0-1) in
   das neue 3D-Format ({x, z, rotationY}, Meter/Radiant, Raummitte =
   Ursprung) um - einmalig beim ersten Laden nach dem Umstieg auf
   Three.js (siehe JS/schloss-3d.js). Rein clientseitige Layout-Daten,
   keine der serverseitig geschützten Felder (ownedFurniture/
   unlockedRooms) sind hier betroffen.

   design/color/customVariantId/scale/content bleiben unverändert -
   nur die Positions-/Ausrichtungsfelder ändern sich.
   ===================================================== */

function migrateSchlossPlacedItems(items, roomWidth, roomDepth) {

    if (!Array.isArray(items)) {
        return [];
    }

    return items.map(function (item) {

        // Schon im neuen Format (z. B. nach einer früheren Migration
        // in dieser Sitzung schon gespeichert) - unverändert lassen.
        if (typeof item.z === "number" && typeof item.rotationY === "number") {
            return item;
        }

        return {
            instanceId: item.instanceId,
            furnitureId: item.furnitureId,
            design: typeof item.design === "number" ? item.design : 0,
            color: item.color || null,
            customVariantId: item.customVariantId || null,
            x: typeof item.x === "number" ? (item.x - 0.5) * roomWidth : 0,
            z: typeof item.y === "number" ? (item.y - 0.5) * roomDepth : 0,
            rotationY: item.flipped ? Math.PI : 0,
            scale: typeof item.scale === "number" ? item.scale : 1,
            content: item.content || null
        };

    });

}
