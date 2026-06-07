import dayjs from "dayjs"
import { openingHours } from "../../utils/opening-hours.js"
import { hoursClick } from "./hours-click.js"

const hours = document.getElementById("hours")

export function hoursLoad({ date, dailySchedules, message = "" }) {
    hours.innerHTML = ""

    if (message) {
        const li = document.createElement("li")
        li.classList.add("hour-empty")
        li.textContent = message
        hours.appendChild(li)
        return
    }

    const unavailableHours = dailySchedules.map((schedule) =>
        dayjs(schedule.when).format("HH:mm")
    )

    const opening = openingHours.map((hour) => {
        const [scheduleHour] = hour.split(":")
        const isHourPast = dayjs(date).add(scheduleHour, "hour").isBefore(dayjs())
        const available = !unavailableHours.includes(hour) && !isHourPast

        return {
            hour,
            available,
        }
    })

    opening.forEach(({ hour, available }) => {
        if (hour === "09:00") {
            hourHeaderAdd("Manha")
        } else if (hour === "13:00") {
            hourHeaderAdd("Tarde")
        } else if (hour === "18:00") {
            hourHeaderAdd("Noite")
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
