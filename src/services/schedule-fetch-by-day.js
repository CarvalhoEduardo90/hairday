import { apiConfig } from "./api-config.js"

export async function scheduleFetchByDay({ date }) {
    try {
        // A API já retorna somente os agendamentos confirmados do dia,
        // no formato { id, when, name, email, phone }.
        const response = await fetch(
            `${apiConfig.baseURL}/appointments?date=${date}`
        )

        if (!response.ok) {
            throw new Error("Falha ao buscar agendamentos")
        }

        return await response.json()
    } catch (error) {
        console.log(error)
        alert(
            "Não foi possível carregar os horários disponíveis. Tente novamente mais tarde."
        )
        // Retorna uma lista vazia para não quebrar quem consome esta função.
        return []
    }
}
