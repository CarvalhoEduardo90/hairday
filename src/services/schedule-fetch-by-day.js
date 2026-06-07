import { apiConfig } from "./api-config.js"

export async function scheduleFetchByDay({ date, barberId = "" }) {
    try {
        const params = new URLSearchParams({ date })

        if (barberId) {
            params.set("barberId", barberId)
        }

        const response = await fetch(`${apiConfig.baseURL}/appointments?${params}`)

        if (!response.ok) {
            throw new Error("Falha ao buscar agendamentos")
        }

        return await response.json()
    } catch (error) {
        console.log(error)
        alert(
            "Nao foi possivel carregar os horarios disponiveis. Tente novamente mais tarde."
        )
        return []
    }
}
