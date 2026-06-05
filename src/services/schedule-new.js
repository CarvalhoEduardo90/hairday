import { apiConfig } from "./api-config.js"

export async function scheduleNew({ name, email, phone, when }) {
    // Realiza a requisição para criar o agendamento.
    const response = await fetch(`${apiConfig.baseURL}/appointments`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ fullName: name, email, phone, when }),
    })

    // Garante que a API confirmou o agendamento antes de prosseguir.
    if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || `Erro ao agendar. Status: ${response.status}`)
    }

    return response.json()
}
