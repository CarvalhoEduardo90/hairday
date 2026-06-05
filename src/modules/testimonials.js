// Carrossel de depoimentos da vitrine (página pública).
// Para personalizar, edite a lista abaixo com depoimentos reais.
const testimonials = [
    {
        text: "Melhor barbearia da região! Atendimento impecável e sempre saio satisfeito com o corte.",
        author: "Rodrigo Gonçalves",
    },
    {
        text: "Profissionais atenciosos e ambiente muito agradável. Virei cliente fiel.",
        author: "Marina Alves",
    },
    {
        text: "Agendamento fácil e sem espera. O resultado supera as expectativas toda vez.",
        author: "Carlos Henrique",
    },
    {
        text: "Como assinante, garanto meu corte toda semana. Vale muito a pena!",
        author: "Felipe Costa",
    },
]

const textEl = document.getElementById("testimonial-text")
const authorEl = document.getElementById("testimonial-author")
const dotsEl = document.getElementById("testimonial-dots")

// Só roda na página pública (onde os elementos existem).
if (textEl && authorEl && dotsEl) {
    let index = 0
    let timer = null

    // Cria os indicadores (bolinhas).
    testimonials.forEach((_, i) => {
        const dot = document.createElement("button")
        dot.type = "button"
        dot.classList.add("dot")
        dot.setAttribute("aria-label", `Depoimento ${i + 1}`)
        dot.addEventListener("click", () => {
            index = i
            render()
            restart()
        })
        dotsEl.appendChild(dot)
    })

    function render() {
        const { text, author } = testimonials[index]
        textEl.textContent = `“${text}”`
        authorEl.textContent = `— ${author}`

        dotsEl.querySelectorAll(".dot").forEach((dot, i) => {
            dot.classList.toggle("active", i === index)
        })
    }

    function next() {
        index = (index + 1) % testimonials.length
        render()
    }

    function restart() {
        if (timer) clearInterval(timer)
        timer = setInterval(next, 5000)
    }

    render()
    restart()
}
