import { hoursClick } from "./hours-click.js"

const hours = document.getElementById("hours")

export function hoursLoad({ availability = [], message = "" }) {
    hours.innerHTML = ""

    if (message) {
        const li = document.createElement("li")
        li.classList.add("hour-empty")
        li.textContent = message
        hours.appendChild(li)
        return
    }

    if (availability.length === 0) {
        const li = document.createElement("li")
        li.classList.add("hour-empty")
        li.textContent = "Nenhum horario disponivel para esta data."
        hours.appendChild(li)
        return
    }

    let currentPeriod = ""

    availability.forEach(({ hour, available }) => {
        const period = periodLabel(hour)

        if (period !== currentPeriod) {
            currentPeriod = period
            hourHeaderAdd(period)
        }

        const li = document.createElement("li")
        li.classList.add("hour")
        li.classList.add(available ? "hour-available" : "hour-unavailable")

        li.textContent = hour
        hours.append(li)
    })

    hoursClick()
}

function hourHeaderAdd(title) {
    const header = document.createElement("li")
    header.classList.add("hour-period")
    header.textContent = title
    hours.appendChild(header)
}

function periodLabel(hour) {
    const [value] = hour.split(":").map(Number)

    if (value < 13) return "Manha"
    if (value < 18) return "Tarde"
    return "Noite"
}
