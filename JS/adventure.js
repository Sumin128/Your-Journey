/* =====================================================
   ABENTEUERAUSWEIS
   ===================================================== */

const scroll = document.getElementById("scroll-image");

let scrollOpen = false;

if (scroll) {

    scroll.addEventListener("click", function () {

        if (scrollOpen) {

            scroll.src = "Images/Scrolls/scroll_closed.png";
            scrollOpen = false;

        } else {

            scroll.src = "Images/Scrolls/scroll_open.png";
            scrollOpen = true;

        }

    });

}