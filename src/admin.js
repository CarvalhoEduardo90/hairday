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

// fetch que injeta o token de autenticação.
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

// Guarda de acesso: exige sessão e papel de admin.
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

// Carrega e renderiza os agendamentos do dia selecionado.
async function loadDay() {
    const date = selectedDate.value
    if (!date) return

    const response = await authFetch(`/admin/appointments?date=${date}`)
    if (!response.ok) {
        alert("Não foi possível carregar os agendamentos.")
        return
    }

    const schedules = await response.json()
    render(schedules)
}

function render(schedules) {
    periodMorning.innerHTML = ""
    periodAfternoon.innerHTML = ""
    periodNight.innerHTML = ""

    schedules.forEach((schedule) => {
        const item = document.createElement("li")
        item.setAttribute("data-id", schedule.id)

        const time = document.createElement("strong")
        time.textContent = dayjs(schedule.when).format("HH:mm")

        const name = document.createElement("span")
        name.classList.add("item-name")
        name.textContent = schedule.name

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
        item.append(time, name, actions)

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
        `Cancelar o agendamento de ${schedule.name} às ${dayjs(
            schedule.when
        ).format("HH:mm")}?`
    )
    if (!ok) return

    const response = await authFetch(`/appointments/${schedule.id}`, {
        method: "DELETE",
    })

    if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        return alert(data.error || "Não foi possível cancelar.")
    }

    alert("Agendamento cancelado.")
    await loadDay()
}

async function rescheduleAppointment(schedule) {
    const current = dayjs(schedule.when).format("HH:00")
    const input = prompt(
        `Novo horário para ${schedule.name} (formato HH:00).\n` +
            `Horários: ${openingHours.join(", ")}`,
        current
    )
    if (!input) return

    const value = input.trim()
    if (!openingHours.includes(value)) {
        return alert("Horário inválido. Use um dos horários de funcionamento.")
    }

    // Mantém o mesmo dia do agendamento, trocando apenas a hora.
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
        return alert(data.error || "Não foi possível remarcar.")
    }

    alert("Agendamento remarcado.")
    await loadDay()
}

logoutButton.addEventListener("click", async () => {
    await supabase.auth.signOut()
    window.location.href = "login.html"
})

selectedDate.onchange = () => loadDay()

// Inicialização.
;(async () => {
    const allowed = await ensureAdmin()
    if (!allowed) return

    selectedDate.value = dayjs().format("YYYY-MM-DD")
    await loadDay()
})()
