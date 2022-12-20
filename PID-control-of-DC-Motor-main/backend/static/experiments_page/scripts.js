let cards = [...document.getElementsByClassName("card")]
cards.forEach(card => {
    card.addEventListener('mouseover', () => {
        card.classList.add("shadow-lg")
        card.style.cursor = "pointer"
    })
    card.addEventListener('mouseout', () => {
        card.classList.remove("shadow-lg")
    })
});