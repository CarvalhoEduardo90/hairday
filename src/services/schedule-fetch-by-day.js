import dayjs from "dayjs"
import { apiConfig } from "./api-config.js"
export async function scheduleFetchByDay({ date }) {
    try {
        // Realiza a requisição.
        const response = await fetch(`${apiConfig.baseURL}/schedules`)
        if (!response.ok) {
            throw new Error("Falha ao buscar agendamentos")
        }
        // Converte a resposta para JSON.
        const schedules = await response.json()
        // Filtra os agendamentos para retornar somente os do dia selecionado.
        const dailySchedules = schedules.filter((schedule) =>
            dayjs(schedule.when).isSame(dayjs(date), "day")
        )
        return dailySchedules
    } catch (error) {
        console.log(error)
        alert("Não foi possível carregar os horários disponíveis. Tente novamente mais tarde.")
    }
}