import dayjs from "dayjs";

const periodMorning = document.getElementById("period-morning")
const periodAfternoon = document.getElementById("period-afternoon")
const periodNight = document.getElementById("period-night")

// Página PÚBLICA: exibe apenas a disponibilidade (horário "Ocupado"),
// sem nome do cliente nem opção de cancelar. A API pública retorna só { when }.
export function schedulesShow({ dailySchedules }) {
    try {
        periodMorning.innerHTML = ""
        periodAfternoon.innerHTML = ""
        periodNight.innerHTML = ""

        dailySchedules.forEach((schedule) => {
            const item = document.createElement("li")
            const time = document.createElement("strong")
            const label = document.createElement("span")

            time.textContent = dayjs(schedule.when).format("HH:mm")
            label.textContent = "Ocupado"

            item.append(time, label)

            const hour = dayjs(schedule.when).hour()

            if (hour <= 12) {
                periodMorning.appendChild(item)
            } else if (hour > 12 && hour <= 18) {
                periodAfternoon.appendChild(item)
            } else {
                periodNight.appendChild(item)
            }
        })
    } catch (error) {
        console.log(error)
        alert("Não foi possível carregar os horários ocupados. Tente novamente mais tarde.")
    }
}
