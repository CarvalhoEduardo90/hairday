import { apiConfig } from "./api-config.js"

export async function scheduleCancel({ id }) {
    const response = await fetch(`${apiConfig.baseURL}/schedules/${id}`, {
        method: "DELETE",
    })

    if (!response.ok) {
        if (response.status === 404) {
            throw new Error("Agendamento não encontrado (404).")
        }
        throw new Error(`Erro ao cancelar. Status: ${response.status}`)
    }
}