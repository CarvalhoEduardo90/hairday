import { apiConfig } from "./api-config.js"

export async function scheduleNew({ name, email, phone, when, service, barber }) {
    const response = await fetch(`${apiConfig.baseURL}/appointments`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            fullName: name,
            email,
            phone,
            when,
            serviceId: service.id,
            serviceName: service.name,
            servicePriceCents: service.priceCents,
            serviceDurationMinutes: service.durationMinutes,
            barberId: barber.id || null,
            barberName: barber.name,
        }),
    })

    if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || `Erro ao agendar. Status: ${response.status}`)
    }

    return response.json()
}
