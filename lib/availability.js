const dayjs = require("dayjs")
const { supabase } = require("./supabase")

const FALLBACK_HOURS = [
    "09:00",
    "10:00",
    "11:00",
    "12:00",
    "13:00",
    "14:00",
    "15:00",
    "16:00",
    "17:00",
    "18:00",
    "19:00",
    "20:00",
    "21:00",
]

function isMissingAvailabilityTable(error) {
    return (
        error?.code === "42P01" ||
        error?.code === "42703" ||
        error?.code === "PGRST204" ||
        /business_hours|business_breaks|schedule_blocks|barber_|service_/i.test(
            error?.message || ""
        )
    )
}

function toMinutes(time) {
    const [hour, minute] = String(time || "00:00").split(":").map(Number)
    return hour * 60 + minute
}

function toTime(minutes) {
    const hour = String(Math.floor(minutes / 60)).padStart(2, "0")
    const minute = String(minutes % 60).padStart(2, "0")
    return `${hour}:${minute}`
}

function normalizeDuration(value, fallback = 60) {
    const duration = Number(value)
    return Number.isInteger(duration) && duration > 0 ? duration : fallback
}

function rangesOverlap(start, end, range) {
    const rangeStart = toMinutes(range.starts_at)
    const rangeEnd = toMinutes(range.ends_at)
    return start < rangeEnd && rangeStart < end
}

function overlaps(slotStart, slotEnd, ranges) {
    return ranges.some((range) => {
        return rangesOverlap(slotStart, slotEnd, range)
    })
}

function fallbackSchedule(date, appointments, serviceDurationMinutes) {
    const fallbackEnd = toMinutes(FALLBACK_HOURS[FALLBACK_HOURS.length - 1]) + 60

    return FALLBACK_HOURS.map((hour) => {
        const slotStart = toMinutes(hour)
        const slotEnd = slotStart + serviceDurationMinutes
        const [scheduleHour, scheduleMinute] = hour.split(":").map(Number)
        const isPast = dayjs(date)
            .add(scheduleHour, "hour")
            .add(scheduleMinute, "minute")
            .isBefore(dayjs())

        return {
            hour,
            available:
                slotEnd <= fallbackEnd &&
                !appointmentsOverlap(slotStart, slotEnd, appointments) &&
                !isPast,
        }
    })
}

function appointmentRange(appointment) {
    const startsAt = dayjs(appointment.when_at)
    const duration = normalizeDuration(appointment.service_duration_minutes)
    const start = startsAt.hour() * 60 + startsAt.minute()

    return {
        id: appointment.id,
        starts_at: toTime(start),
        ends_at: toTime(start + duration),
    }
}

function appointmentsOverlap(slotStart, slotEnd, appointments) {
    return appointments.some((appointment) =>
        rangesOverlap(slotStart, slotEnd, appointment)
    )
}

async function fetchAppointments({ date, barberId, excludeAppointmentId }) {
    const start = dayjs(date).startOf("day").toISOString()
    const end = dayjs(date).endOf("day").toISOString()

    let query = supabase
        .from("appointments")
        .select(
            barberId
                ? "id, when_at, service_duration_minutes, barber_id"
                : "id, when_at, service_duration_minutes"
        )
        .gte("when_at", start)
        .lte("when_at", end)
        .eq("status", "confirmed")

    if (barberId) {
        query = query.or(`barber_id.eq.${barberId},barber_id.is.null`)
    }

    let { data, error } = await query

    if (error && isMissingAvailabilityTable(error)) {
        let fallbackQuery = supabase
            .from("appointments")
            .select(barberId ? "id, when_at, barber_id" : "id, when_at")
            .gte("when_at", start)
            .lte("when_at", end)
            .eq("status", "confirmed")

        if (barberId) {
            fallbackQuery = fallbackQuery.or(
                `barber_id.eq.${barberId},barber_id.is.null`
            )
        }

        let fallback = await fallbackQuery

        if (fallback.error && barberId && isMissingAvailabilityTable(fallback.error)) {
            fallback = await supabase
                .from("appointments")
                .select("id, when_at")
                .gte("when_at", start)
                .lte("when_at", end)
                .eq("status", "confirmed")
        }

        data = fallback.data
        error = fallback.error
    }

    if (error) throw error

    return (data || [])
        .filter((appointment) => appointment.id !== excludeAppointmentId)
        .map(appointmentRange)
}

async function fetchDayRules({ date, barberId }) {
    const weekday = dayjs(date).day()

    const [{ data: hours, error: hoursError }, { data: breaks, error: breaksError }] =
        await Promise.all([
            supabase
                .from("business_hours")
                .select("day_of_week, opens_at, closes_at, slot_interval_minutes, active")
                .eq("day_of_week", weekday)
                .maybeSingle(),
            supabase
                .from("business_breaks")
                .select("starts_at, ends_at")
                .eq("day_of_week", weekday)
                .eq("active", true),
        ])

    if (hoursError && isMissingAvailabilityTable(hoursError)) return null
    if (breaksError && isMissingAvailabilityTable(breaksError)) return null
    if (hoursError) throw hoursError
    if (breaksError) throw breaksError

    let blockQuery = supabase
        .from("schedule_blocks")
        .select("starts_at, ends_at, barber_id")
        .eq("block_date", date)
        .eq("active", true)

    const { data: blocks, error: blocksError } = await blockQuery

    if (blocksError && isMissingAvailabilityTable(blocksError)) return null
    if (blocksError) throw blocksError

    const filteredBlocks = (blocks || []).filter(
        (block) => !block.barber_id || !barberId || block.barber_id === barberId
    )

    return {
        hours,
        breaks: breaks || [],
        blocks: filteredBlocks,
    }
}

function generateConfiguredSchedule({ date, appointments, rules, serviceDurationMinutes }) {
    if (!rules?.hours || !rules.hours.active) {
        return []
    }

    const opening = []
    const start = toMinutes(rules.hours.opens_at)
    const end = toMinutes(rules.hours.closes_at)
    const interval = Number(rules.hours.slot_interval_minutes || 60)
    const blockedRanges = [...rules.breaks, ...rules.blocks]

    for (let minutes = start; minutes < end; minutes += interval) {
        const hour = toTime(minutes)
        const slotEnd = minutes + serviceDurationMinutes
        const [scheduleHour, scheduleMinute] = hour.split(":").map(Number)
        const isPast = dayjs(date)
            .add(scheduleHour, "hour")
            .add(scheduleMinute, "minute")
            .isBefore(dayjs())

        opening.push({
            hour,
            available:
                slotEnd <= end &&
                !appointmentsOverlap(minutes, slotEnd, appointments) &&
                !overlaps(minutes, slotEnd, blockedRanges) &&
                !isPast,
        })
    }

    return opening
}

async function getDailyAvailability({
    date,
    barberId = "",
    excludeAppointmentId = "",
    serviceDurationMinutes = 60,
}) {
    const duration = normalizeDuration(serviceDurationMinutes)
    const appointments = await fetchAppointments({
        date,
        barberId,
        excludeAppointmentId,
    })
    const rules = await fetchDayRules({ date, barberId })

    if (!rules) {
        return fallbackSchedule(date, appointments, duration)
    }

    return generateConfiguredSchedule({
        date,
        appointments,
        rules,
        serviceDurationMinutes: duration,
    })
}

async function isSlotAvailable({
    when,
    barberId = "",
    excludeAppointmentId = "",
    serviceDurationMinutes = 60,
}) {
    const date = dayjs(when).format("YYYY-MM-DD")
    const hour = dayjs(when).format("HH:mm")
    const availability = await getDailyAvailability({
        date,
        barberId,
        excludeAppointmentId,
        serviceDurationMinutes,
    })

    return availability.some((slot) => slot.hour === hour && slot.available)
}

module.exports = {
    FALLBACK_HOURS,
    getDailyAvailability,
    isMissingAvailabilityTable,
    isSlotAvailable,
}
