export const serviceOptions = [
    {
        id: "corte-social",
        name: "Corte social",
        priceCents: 3500,
        durationMinutes: 40,
    },
    {
        id: "barba",
        name: "Barba",
        priceCents: 2500,
        durationMinutes: 30,
    },
    {
        id: "corte-barba",
        name: "Corte + barba",
        priceCents: 5500,
        durationMinutes: 60,
    },
    {
        id: "hidratacao",
        name: "Hidratacao",
        priceCents: 4500,
        durationMinutes: 45,
    },
    {
        id: "botox",
        name: "Botox capilar",
        priceCents: 9000,
        durationMinutes: 90,
    },
]

export const barberOptions = [
    {
        id: "",
        name: "Sem preferencia",
    },
    {
        id: "barbeiro-joao",
        name: "Joao",
    },
    {
        id: "barbeiro-marcos",
        name: "Marcos",
    },
]

export function formatPrice(priceCents) {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(priceCents / 100)
}
