import { apiConfig } from "./api-config.js"

export async function scheduleAvailability({
    date,
    barberId = "",
    serviceDurationMinutes = 60,
}) {
    try {
        const params = new URLSearchParams({
            date,
            serviceDurationMinutes: String(serviceDurationMinutes),
        })

        if (barberId) {
            params.set("barberId", barberId)
        }

        const response = await fetch(`${apiConfig.baseURL}/availability?${params}`)

        if (!response.ok) {
            throw new Error("Falha ao buscar disponibilidade")
        }

        const data = await response.json()
        return Array.isArray(data.hours) ? data.hours : []
    } catch (error) {
        console.log(error)
        alert(
            "Nao foi possivel carregar os horarios disponiveis. Tente novamente mais tarde."
        )
        return []
    }
}
