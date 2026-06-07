"use strict"

import "./libs/dayjs.js"
import "./styles/global.css"
import "./styles/form.css"
import "./styles/schedule.css"

import dayjs from "dayjs"
import { supabase, getAccessToken } from "./libs/supabase-client.js"
import { apiConfig } from "./services/api-config.js"
import { openingHours } from "./utils/opening-hours.js"

const selectedDate = document.getElementById("date")
const logoutButton = document.getElementById("logout")
const periodMorning = document.getElementById("period-morning")
const periodAfternoon = document.getElementById("period-afternoon")
const periodNight = document.getElementById("period-night")
const calendarGrid = document.getElementById("calendar-grid")
const calendarMonth = document.getElementById("calendar-month")
const prevMonthButton = document.getElementById("prev-month")
const nextMonthButton = document.getElementById("next-month")
const todayButton = document.getElementById("today-button")
const selectedDayTitle = document.getElementById("selected-day-title")
const selectedDayMeta = document.getElementById("selected-day-meta")
const dayCount = document.getElementById("day-count")
const monthCount = document.getElementById("month-count")
const dayRevenue = document.getElementById("day-revenue")

let currentMonth = dayjs().startOf("month")
let selectedDay = dayjs()
let monthSchedules = []
let loadRequestId = 0

function categoryLabel(category) {
    const labels = {
        avulso: "Avulso",
        cadastrado: "Cadastrado",
        assinante: "Assinante",
    }
    return labels[category] || "Avulso"
}

function formatDate(date) {
    return dayjs(date).format("YYYY-MM-DD")
}

function formatCurrency(cents) {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(cents / 100)
}

function formatLongDate(date) {
    return new Intl.DateTimeFormat("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
    }).format(dayjs(date).toDate())
}

function formatMonth(date) {
    return new Intl.DateTimeFormat("pt-BR", {
        month: "long",
        year: "numeric",
    }).format(dayjs(date).toDate())
}

async function authFetch(path, options = {}) {
    const token = await getAccessToken()
    return fetch(`${apiConfig.baseURL}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...(options.headers || {}),
        },
    })
}

async function ensureAdmin() {
    const token = await getAccessToken()
    if (!token) {
        window.location.href = "login.html"
        return false
    }

    const response = await authFetch("/me")
    if (!response.ok) {
        window.location.href = "login.html"
        return false
    }

    const me = await response.json()
    if (!me.isAdmin) {
        alert("Acesso restrito ao administrador.")
        await supabase.auth.signOut()
        window.location.href = "login.html"
        return false
    }
    return true
}

async function loadMonth() {
    const requestId = ++loadRequestId
    const start = currentMonth.startOf("month").format("YYYY-MM-DD")
    const end = currentMonth.endOf("month").format("YYYY-MM-DD")

    setCalendarLoading(true)
    renderDayMessage("Carregando agendamentos...")

    try {
        const response = await authFetch(
            `/admin/appointments?start=${start}&end=${end}`
        )

        if (!response.ok) {
            const data = await response.json().catch(() => ({}))
            throw new Error(data.error || "Nao foi possivel carregar os agendamentos.")
        }

        const schedules = await response.json()
        if (requestId !== loadRequestId) return

        monthSchedules = schedules
        renderCalendar()
        renderSelectedDay()
    } catch (error) {
        if (requestId !== loadRequestId) return

        monthSchedules = []
        renderCalendar()
        renderDayMessage(error.message || "Nao foi possivel carregar os agendamentos.")
    } finally {
        if (requestId === loadRequestId) {
            setCalendarLoading(false)
        }
    }
}

function setCalendarLoading(loading) {
    prevMonthButton.disabled = loading
    nextMonthButton.disabled = loading
    todayButton.disabled = loading
}

function renderDayMessage(message) {
    periodMorning.innerHTML = ""
    periodAfternoon.innerHTML = ""
    periodNight.innerHTML = ""

    dayCount.textContent = "0"
    monthCount.textContent = "0"
    dayRevenue.textContent = formatCurrency(0)
    selectedDayTitle.textContent = formatLongDate(selectedDay)
    selectedDayMeta.textContent = selectedDay.isSame(dayjs(), "day")
        ? "Hoje"
        : selectedDay.format("DD/MM/YYYY")

    const li = document.createElement("li")
    li.classList.add("empty")
    li.textContent = message
    periodMorning.appendChild(li)
    fillEmptyPeriods()
}

function schedulesByDate() {
    return monthSchedules.reduce((acc, schedule) => {
        const date = formatDate(schedule.when)
        acc[date] = acc[date] || []
        acc[date].push(schedule)
        return acc
    }, {})
}

function renderCalendar() {
    calendarGrid.innerHTML = ""
    calendarMonth.textContent = formatMonth(currentMonth)

    const counts = schedulesByDate()
    const firstCell = currentMonth
        .startOf("month")
        .subtract(currentMonth.startOf("month").day(), "day")

    for (let index = 0; index < 42; index++) {
        const date = firstCell.add(index, "day")
        const dateValue = formatDate(date)
        const count = counts[dateValue]?.length || 0

        const button = document.createElement("button")
        button.type = "button"
        button.classList.add("calendar-day")
        button.dataset.date = dateValue
        button.setAttribute("aria-label", formatLongDate(date))

        if (!date.isSame(currentMonth, "month")) {
            button.classList.add("calendar-day-muted")
        }
        if (date.isSame(dayjs(), "day")) {
            button.classList.add("calendar-day-today")
        }
        if (date.isSame(selectedDay, "day")) {
            button.classList.add("calendar-day-selected")
        }

        const number = document.createElement("span")
        number.classList.add("calendar-number")
        number.textContent = date.format("D")

        const indicator = document.createElement("span")
        indicator.classList.add(count ? "calendar-count" : "calendar-empty-count")
        indicator.textContent = count ? String(count) : ""

        button.append(number, indicator)
        button.addEventListener("click", () => selectDay(date))
        calendarGrid.appendChild(button)
    }
}

async function selectDay(date) {
    selectedDay = dayjs(date)
    selectedDate.value = selectedDay.format("YYYY-MM-DD")

    if (!selectedDay.isSame(currentMonth, "month")) {
        currentMonth = selectedDay.startOf("month")
        await loadMonth()
        return
    }

    renderCalendar()
    renderSelectedDay()
}

function renderSelectedDay() {
    const selectedValue = selectedDay.format("YYYY-MM-DD")
    const schedules = monthSchedules
        .filter((schedule) => formatDate(schedule.when) === selectedValue)
        .sort((a, b) => dayjs(a.when) - dayjs(b.when))

    selectedDayTitle.textContent = formatLongDate(selectedDay)
    selectedDayMeta.textContent = selectedDay.isSame(dayjs(), "day")
        ? "Hoje"
        : selectedDay.format("DD/MM/YYYY")

    renderSchedules(schedules)
}

function renderSchedules(schedules) {
    periodMorning.innerHTML = ""
    periodAfternoon.innerHTML = ""
    periodNight.innerHTML = ""

    dayCount.textContent = String(schedules.length)
    monthCount.textContent = String(monthSchedules.length)
    dayRevenue.textContent = formatCurrency(
        schedules.reduce(
            (total, schedule) => total + Number(schedule.servicePriceCents || 0),
            0
        )
    )

    schedules.forEach((schedule) => {
        const item = document.createElement("li")
        item.setAttribute("data-id", schedule.id)

        const time = document.createElement("strong")
        time.textContent = dayjs(schedule.when).format("HH:mm")

        const name = document.createElement("span")
        name.classList.add("item-name")
        name.textContent = schedule.name

        const details = document.createElement("small")
        details.classList.add("item-details")
        details.textContent = [schedule.serviceName, schedule.barberName]
            .filter(Boolean)
            .join(" - ")

        const badge = document.createElement("span")
        badge.classList.add("badge", `badge-${schedule.category}`)
        badge.textContent = categoryLabel(schedule.category)

        const actions = document.createElement("div")
        actions.classList.add("item-actions")

        const rescheduleBtn = document.createElement("button")
        rescheduleBtn.type = "button"
        rescheduleBtn.textContent = "Remarcar"
        rescheduleBtn.addEventListener("click", () =>
            rescheduleAppointment(schedule)
        )

        const cancelBtn = document.createElement("button")
        cancelBtn.type = "button"
        cancelBtn.textContent = "Cancelar"
        cancelBtn.addEventListener("click", () => cancelAppointment(schedule))

        actions.append(rescheduleBtn, cancelBtn)
        item.append(time, name)

        if (details.textContent) {
            item.append(details)
        }

        item.append(badge, actions)

        const hour = dayjs(schedule.when).hour()
        if (hour <= 12) {
            periodMorning.appendChild(item)
        } else if (hour > 12 && hour <= 18) {
            periodAfternoon.appendChild(item)
        } else {
            periodNight.appendChild(item)
        }
    })

    fillEmptyPeriods()
}

function fillEmptyPeriods() {
    ;[periodMorning, periodAfternoon, periodNight].forEach((ul) => {
        if (ul.children.length === 0) {
            const li = document.createElement("li")
            li.classList.add("empty")
            li.textContent = "Sem agendamentos."
            ul.appendChild(li)
        }
    })
}

async function cancelAppointment(schedule) {
    const ok = confirm(
        `Cancelar o agendamento de ${schedule.name} as ${dayjs(
            schedule.when
        ).format("HH:mm")}?`
    )
    if (!ok) return

    const response = await authFetch(`/appointments/${schedule.id}`, {
        method: "DELETE",
    })

    if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        return alert(data.error || "Nao foi possivel cancelar.")
    }

    alert("Agendamento cancelado.")
    await loadMonth()
}

async function rescheduleAppointment(schedule) {
    const current = dayjs(schedule.when).format("HH:00")
    const input = prompt(
        `Novo horario para ${schedule.name} (formato HH:00).\n` +
            `Horarios: ${openingHours.join(", ")}`,
        current
    )
    if (!input) return

    const value = input.trim()
    if (!openingHours.includes(value)) {
        return alert("Horario invalido. Use um dos horarios de funcionamento.")
    }

    const [hour] = value.split(":")
    const when = dayjs(schedule.when)
        .startOf("day")
        .add(Number(hour), "hour")
        .toISOString()

    const response = await authFetch(`/appointments/${schedule.id}`, {
        method: "PATCH",
        body: JSON.stringify({ when }),
    })

    if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        return alert(data.error || "Nao foi possivel remarcar.")
    }

    alert("Agendamento remarcado.")
    selectedDay = dayjs(when)
    currentMonth = selectedDay.startOf("month")
    await loadMonth()
}

logoutButton.addEventListener("click", async () => {
    await supabase.auth.signOut()
    window.location.href = "login.html"
})

prevMonthButton.addEventListener("click", async () => {
    currentMonth = currentMonth.subtract(1, "month")
    selectedDay = currentMonth.startOf("month")
    selectedDate.value = selectedDay.format("YYYY-MM-DD")
    await loadMonth()
})

nextMonthButton.addEventListener("click", async () => {
    currentMonth = currentMonth.add(1, "month")
    selectedDay = currentMonth.startOf("month")
    selectedDate.value = selectedDay.format("YYYY-MM-DD")
    await loadMonth()
})

todayButton.addEventListener("click", async () => {
    selectedDay = dayjs()
    currentMonth = selectedDay.startOf("month")
    selectedDate.value = selectedDay.format("YYYY-MM-DD")
    await loadMonth()
})

;(async () => {
    const allowed = await ensureAdmin()
    if (!allowed) return

    selectedDate.value = selectedDay.format("YYYY-MM-DD")
    await loadMonth()
})()
