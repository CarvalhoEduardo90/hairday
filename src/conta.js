"use strict"

import "./libs/dayjs.js"
import "./styles/global.css"
import "./styles/form.css"

import dayjs from "dayjs"
import { supabase, getAccessToken } from "./libs/supabase-client.js"
import { apiConfig } from "./services/api-config.js"
import { openingHours } from "./utils/opening-hours.js"

const logoutButton = document.getElementById("logout")
const accountEmail = document.getElementById("account-email")
const list = document.getElementById("appointments")

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

// Exige sessão ativa.
async function ensureLoggedIn() {
    const { data } = await supabase.auth.getSession()
    if (!data.session) {
        window.location.href = "login.html"
        return null
    }
    return data.session.user
}

async function loadAppointments() {
    const response = await authFetch("/my-appointments")
    if (!response.ok) {
        alert("Não foi possível carregar seus agendamentos.")
        return
    }

    const schedules = await response.json()
    render(schedules)
}

function render(schedules) {
    list.innerHTML = ""

    if (schedules.length === 0) {
        const empty = document.createElement("li")
        empty.classList.add("empty")
        empty.textContent = "Você não tem agendamentos futuros."
        list.appendChild(empty)
        return
    }

    schedules.forEach((schedule) => {
        const item = document.createElement("li")

        const when = document.createElement("span")
        when.classList.add("when")
        when.textContent = dayjs(schedule.when).format("DD/MM/YYYY [às] HH:mm")

        const rescheduleBtn = document.createElement("button")
        rescheduleBtn.type = "button"
        rescheduleBtn.textContent = "Remarcar"
        rescheduleBtn.addEventListener("click", () => reschedule(schedule))

        const cancelBtn = document.createElement("button")
        cancelBtn.type = "button"
        cancelBtn.textContent = "Cancelar"
        cancelBtn.addEventListener("click", () => cancel(schedule))

        item.append(when, rescheduleBtn, cancelBtn)
        list.appendChild(item)
    })
}

async function cancel(schedule) {
    const ok = confirm(
        `Cancelar seu agendamento de ${dayjs(schedule.when).format(
            "DD/MM [às] HH:mm"
        )}?`
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
    await loadAppointments()
}

async function reschedule(schedule) {
    const current = dayjs(schedule.when).format("HH:00")
    const input = prompt(
        `Novo horário (formato HH:00), mesmo dia.\n` +
            `Horários: ${openingHours.join(", ")}`,
        current
    )
    if (!input) return

    const value = input.trim()
    if (!openingHours.includes(value)) {
        return alert("Horário inválido. Use um dos horários de funcionamento.")
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
        return alert(data.error || "Não foi possível remarcar.")
    }

    alert("Agendamento remarcado.")
    await loadAppointments()
}

logoutButton.addEventListener("click", async () => {
    await supabase.auth.signOut()
    window.location.href = "login.html"
})

// Inicialização.
;(async () => {
    const user = await ensureLoggedIn()
    if (!user) return

    accountEmail.textContent = user.email
    await loadAppointments()
})()
