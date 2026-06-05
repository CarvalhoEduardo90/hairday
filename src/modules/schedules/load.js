import { scheduleFetchByDay } from "../../services/schedule-fetch-by-day.js"
import { hoursLoad } from "../form/hours-load.js"

// Seleciona o input de data para obter a data selecionada pelo usuário
const selectedDate = document.getElementById("date")

export async function schedulesDay() {
    // Obtem a data do input.
    const date = selectedDate.value

    // Busca na API a disponibilidade do dia (somente horários ocupados).
    const dailySchedules = await scheduleFetchByDay({ date })

    // Renderiza as horas disponíveis no formulário (desabilita as ocupadas).
    hoursLoad({ date, dailySchedules })
}