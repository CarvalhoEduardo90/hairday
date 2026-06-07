import { scheduleAvailability } from "../../services/schedule-availability.js"
import { hoursLoad } from "../form/hours-load.js"
import { getSelectedBarber, getSelectedService } from "../form/service-select.js"

const selectedDate = document.getElementById("date")

export async function schedulesDay() {
    const date = selectedDate.value
    const service = getSelectedService()

    if (!service) {
        hoursLoad({
            date,
            dailySchedules: [],
            message: "Escolha um servico para ver os horarios.",
        })
        return
    }

    const barber = getSelectedBarber()
    const availability = await scheduleAvailability({
        date,
        barberId: barber.id,
        serviceDurationMinutes: service.durationMinutes,
    })

    hoursLoad({ date, availability })
}
