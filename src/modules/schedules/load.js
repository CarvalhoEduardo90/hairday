import { scheduleFetchByDay } from "../../services/schedule-fetch-by-day.js"
import { schedulesShow } from "../schedules/show.js"
import { hoursLoad } from "../form/hours-load.js"

// Seleciona o input de data para obter a data selecionada pelo usuário
const selectedDate = document.getElementById("date")

export async function schedulesDay() {
    // Obtem a data do input.
    const date = selectedDate.value

    //Busca na API os agendamentos para o dia selecionado.
    const dailySchedules = await scheduleFetchByDay({ date })

    // Exibe os horários ocupados para o dia selecionado.
    schedulesShow({ dailySchedules })

    // Renderiza as horas disponiveis.
    hoursLoad({date, dailySchedules})
}