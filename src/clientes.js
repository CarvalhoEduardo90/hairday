"use strict"

import "./libs/dayjs.js"
import "./styles/global.css"
import "./styles/form.css"

import { supabase, getAccessToken } from "./libs/supabase-client.js"
import { apiConfig } from "./services/api-config.js"

const logoutButton = document.getElementById("logout")
const list = document.getElementById("clients")

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
        const button = document.createElement("button")
        button.type = "button"

        if (!client.hasAccount) {
            // Sem conta não pode ser assinante.
            button.textContent = "Sem conta"
            button.disabled = true
        } else if (client.isSubscriber) {
            button.textContent = "Remover assinante"
            button.addEventListener("click", () => toggle(client, false))
        } else {
            button.textContent = "Tornar assinante"
            button.addEventListener("click", () => toggle(client, true))
        }

        actionWrap.appendChild(button)
        item.append(info, badge, actionWrap)
        list.appendChild(item)
    })
}

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
