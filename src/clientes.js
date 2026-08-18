"use strict"

import "./libs/dayjs.js"
import "./styles/global.css"
import "./styles/form.css"

import dayjs from "dayjs"
import { supabase } from "./libs/supabase-client.js"
import { authFetch, requireCapability, can } from "./modules/session.js"

const logoutButton = document.getElementById("logout")
const list = document.getElementById("clients")

const historyModal = document.getElementById("history-modal")
const historyTitle = document.getElementById("history-title")
const historyListEl = document.getElementById("history-list")
const historyClose = document.getElementById("history-close")

// Sessão do usuário logado, preenchida por ensureAccess().
let session = null

// Entram admin e o perfil "agendamento" (leitura). As ações de gestão
// aparecem só para quem tem clients:manage — ver render().
async function ensureAccess() {
    session = await requireCapability("clients:read")
    return Boolean(session)
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

// Rótulos dos perfis. As chaves batem com lib/permissions.js (ROLES).
const ROLE_LABELS = {
    admin: "Admin",
    scheduler: "Agendamento",
    client: "Cliente",
}

// Seletor de perfil de um cliente. Salva ao trocar; em caso de erro,
// volta ao valor anterior para a tela não mentir sobre o estado.
function buildRoleSelect(client) {
    const select = document.createElement("select")
    select.classList.add("role-select")
    select.setAttribute("aria-label", `Perfil de ${client.name}`)

    Object.entries(ROLE_LABELS).forEach(([value, label]) => {
        const option = document.createElement("option")
        option.value = value
        option.textContent = label
        select.appendChild(option)
    })

    select.value = client.role || "client"

    // O admin logado não muda o próprio perfil (a API também recusa).
    const isSelf = client.email?.toLowerCase() === session?.email
    select.disabled = isSelf
    if (isSelf) select.title = "Você não pode alterar o seu próprio perfil."

    select.addEventListener("change", async () => {
        const previous = client.role || "client"
        const role = select.value

        select.disabled = true
        const response = await authFetch("/admin/roles", {
            method: "PATCH",
            body: JSON.stringify({ email: client.email, role }),
        })
        select.disabled = false

        if (!response.ok) {
            const data = await response.json().catch(() => ({}))
            alert(data.error || "Não foi possível alterar o perfil.")
            select.value = previous
            return
        }

        client.role = role
    })

    return select
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

        actionWrap.append(historyBtn)

        // Convite e assinatura são de quem gerencia clientes; o perfil
        // "agendamento" fica só com a leitura e o histórico.
        if (can(session, "clients:manage")) {
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

            actionWrap.append(button)
        }

        // Perfil de acesso: só o admin atribui, e só faz sentido para quem
        // já tem conta (o vínculo do papel é pelo e-mail do login).
        if (can(session, "roles:manage") && client.hasAccount) {
            actionWrap.append(buildRoleSelect(client))
        }

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
    const allowed = await ensureAccess()
    if (!allowed) return
    await loadClients()
})()
