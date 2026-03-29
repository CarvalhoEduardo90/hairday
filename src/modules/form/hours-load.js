import dayjs from "dayjs"
import { openingHours } from "../../utils/opening-hours.js"
import { hoursClick } from "./hours-click.js"

const hours = document.getElementById("hours")

export function hoursLoad({ date, dailySchedules }) {
    // Limpa a lista de horários.
    hours.innerHTML = ""

    // Obtem os horários ocupados para o dia selecionado.
    const unavailableHours = dailySchedules.map((schedule) =>
        dayjs(schedule.when).format("HH:mm")
    )

    const opening = openingHours.map((hour) => {
        // Recuperar somente a hora.
        const [scheduleHour] = hour.split(":")

        // Adicionar o horário na data e verificar se esta no passado.
        const isHourPast = dayjs(date).add(scheduleHour, "hour").isBefore(dayjs())

        const available = !unavailableHours.includes(hour) && !isHourPast

        return {
            hour,
            available
        }
    })

    // Renderizar os horários disponíveis.
    opening.forEach(({ hour, available }) => {
        // Adicionar um header para cada período do dia.
        if (hour === "09:00") {
            hourHeaderAdd("Manhã")
        } else if (hour === "13:00") {
            hourHeaderAdd("Tarde")
        } else if (hour === "18:00") {
            hourHeaderAdd("Noite")
        }

        // Criar um elemento li para cada horário e adicionar as classes de disponibilidade.
        const li = document.createElement("li")
        li.classList.add("hour")
        li.classList.add(available ? "hour-available" : "hour-unavailable")

        li.textContent = hour
        hours.append(li)
        hoursClick()
    })
}
function hourHeaderAdd(title) {
    const header = document.createElement("li")
    header.classList.add("hour-period")
    header.textContent = title
    hours.appendChild(header)
}