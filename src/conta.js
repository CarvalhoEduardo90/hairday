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
const upcomingList = document.getElementById("upcoming")
const historyList = document.getElementById("history")

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

// Classifica um agendamento em próximo / realizado / cancelado.
function statusInfo(schedule) {
    if (schedule.status === "cancelled") {
        return { label: "Cancelado", cls: "st-cancelled" }
    }
    if (dayjs(schedule.when).isBefore(dayjs())) {
        return { label: "Realizado", cls: "st-done" }
    }
    return { label: "Próximo", cls: "st-upcoming" }
}

async function loadAppointments() {
    const response = await authFetch("/my-appointments")
    if (!response.ok) {
        alert("Não foi possível carregar seus agendamentos.")
        return
    }

    const all = await response.json()

    // Próximos = confirmados e ainda no futuro (ordem crescente).
    const upcoming = all
        .filter(
            (s) => s.status === "confirmed" && dayjs(s.when).isAfter(dayjs())
        )
        .sort((a, b) => dayjs(a.when) - dayjs(b.when))

    // Histórico = o restante (passados ou cancelados), mais recentes primeiro.
    const history = all
        .filter(
            (s) => !(s.status === "confirmed" && dayjs(s.when).isAfter(dayjs()))
        )
        .sort((a, b) => dayjs(b.when) - dayjs(a.when))

    renderUpcoming(upcoming)
    renderHistory(history)
}

function renderUpcoming(schedules) {
    upcomingList.innerHTML = ""

    if (schedules.length === 0) {
        upcomingList.appendChild(emptyItem("Você não tem agendamentos futuros."))
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
        upcomingList.appendChild(item)
    })
}

function renderHistory(schedules) {
    historyList.innerHTML = ""

    if (schedules.length === 0) {
        historyList.appendChild(emptyItem("Nenhum agendamento no histórico."))
        return
    }

    schedules.forEach((schedule) => {
        const item = document.createElement("li")

        const when = document.createElement("span")
        when.classList.add("when")
        when.textContent = dayjs(schedule.when).format("DD/MM/YYYY [às] HH:mm")

        const { label, cls } = statusInfo(schedule)
        const status = document.createElement("span")
        status.classList.add("status", cls)
        status.textContent = label

        item.append(when, status)
        historyList.appendChild(item)
    })
}

function emptyItem(text) {
    const li = document.createElement("li")
    li.classList.add("empty")
    li.textContent = text
    return li
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
