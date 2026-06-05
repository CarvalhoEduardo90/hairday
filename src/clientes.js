"use strict"

import "./libs/dayjs.js"
import "./styles/global.css"
import "./styles/form.css"

import dayjs from "dayjs"
import { supabase, getAccessToken } from "./libs/supabase-client.js"
import { apiConfig } from "./services/api-config.js"

const logoutButton = document.getElementById("logout")
const list = document.getElementById("clients")

const historyModal = document.getElementById("history-modal")
const historyTitle = document.getElementById("history-title")
const historyListEl = document.getElementById("history-list")
const historyClose = document.getElementById("history-close")

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

function categoryLabel(category) {
    const labels = {
        avulso: "Avulso",
        cadastrado: "Cadastrado",
        assinante: "Assinante",
    }
    return labels[category] || "Avulso"
}

async function loadClients() {
    const response = await authFetch("/admin/clients")
    if (!response.ok) {
        alert("Não foi possível carregar os clientes.")
        return
    }

    const clients = await response.json()
    render(clients)
}

function setButtonLoading(button, loading, label) {
    button.disabled = loading
    if (loading) {
        button.dataset.originalText = button.textContent
        button.textContent = label
    } else if (button.dataset.originalText) {
        button.textContent = button.dataset.originalText
        delete button.dataset.originalText
    }
}

function render(clients) {
    list.innerHTML = ""

    if (clients.length === 0) {
        const empty = document.createElement("li")
        empty.classList.add("empty")
        empty.textContent = "Nenhum cliente cadastrado ainda."
        list.appendChild(empty)
        return
    }

    clients.forEach((client) => {
        const item = document.createElement("li")

        const info = document.createElement("div")
        info.classList.add("client-info")
        const name = document.createElement("strong")
        name.textContent = client.name
        const contact = document.createElement("span")
        contact.textContent = `${client.email} · ${client.phone}`
        info.append(name, contact)

        const badge = document.createElement("span")
        badge.classList.add("badge", `badge-${client.category}`)
        badge.textContent = categoryLabel(client.category)

        const actionWrap = document.createElement("div")
        actionWrap.classList.add("client-action")

        const historyBtn = document.createElement("button")
        historyBtn.type = "button"
        historyBtn.textContent = "Histórico"
        historyBtn.addEventListener("click", () => openHistory(client))

        const button = document.createElement("button")
        button.type = "button"

        if (!client.hasAccount) {
            // Primeiro envia o convite; depois a conta pode ser marcada como assinante.
            button.textContent = "Enviar convite"
            button.addEventListener("click", () => invite(client, button))
        } else if (client.isSubscriber) {
            button.textContent = "Remover assinante"
            button.addEventListener("click", () => toggle(client, false))
        } else {
            button.textContent = "Tornar assinante"
            button.addEventListener("click", () => toggle(client, true))
        }

        actionWrap.append(historyBtn, button)
        item.append(info, badge, actionWrap)
        list.appendChild(item)
    })
}

// ===== Histórico do cliente (modal) =====
function statusInfo(schedule) {
    if (schedule.status === "cancelled") {
        return { label: "Cancelado", cls: "st-cancelled" }
    }
    if (dayjs(schedule.when).isBefore(dayjs())) {
        return { label: "Realizado", cls: "st-done" }
    }
    return { label: "Próximo", cls: "st-upcoming" }
}

async function openHistory(client) {
    historyTitle.textContent = `Histórico — ${client.name}`
    historyListEl.innerHTML = "<li class='empty'>Carregando…</li>"
    historyModal.hidden = false

    const response = await authFetch(`/admin/client-history?clientId=${client.id}`)
    if (!response.ok) {
        historyListEl.innerHTML = "<li class='empty'>Erro ao carregar o histórico.</li>"
        return
    }

    const history = await response.json()
    historyListEl.innerHTML = ""

    if (history.length === 0) {
        historyListEl.innerHTML = "<li class='empty'>Nenhum agendamento.</li>"
        return
    }

    history.forEach((schedule) => {
        const li = document.createElement("li")

        const when = document.createElement("span")
        when.classList.add("when")
        when.textContent = dayjs(schedule.when).format("DD/MM/YYYY [às] HH:mm")

        const { label, cls } = statusInfo(schedule)
        const status = document.createElement("span")
        status.classList.add("status", cls)
        status.textContent = label

        li.append(when, status)
        historyListEl.appendChild(li)
    })
}

function closeHistory() {
    historyModal.hidden = true
}

historyClose.addEventListener("click", closeHistory)
historyModal.addEventListener("click", (event) => {
    if (event.target === historyModal) closeHistory()
})
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !historyModal.hidden) closeHistory()
})

async function toggle(client, isSubscriber) {
    const response = await authFetch(`/admin/clients/${client.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isSubscriber }),
    })

    if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        return alert(data.error || "Não foi possível atualizar o cliente.")
    }

    await loadClients()
}

async function invite(client, button) {
    setButtonLoading(button, true, "Enviando...")

    const response = await authFetch("/admin/clients/invite", {
        method: "POST",
        body: JSON.stringify({ clientId: client.id }),
    })

    if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        setButtonLoading(button, false)
        return alert(data.error || "Nao foi possivel enviar o convite.")
    }

    alert(`Convite enviado para ${client.email}.`)
    await loadClients()
}

logoutButton.addEventListener("click", async () => {
    await supabase.auth.signOut()
    window.location.href = "login.html"
})

// Inicialização.
;(async () => {
    const allowed = await ensureAdmin()
    if (!allowed) return
    await loadClients()
})()
