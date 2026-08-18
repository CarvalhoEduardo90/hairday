"use strict"

// Sessão e permissões do front.
//
// Substitui o ensureAdmin() que estava duplicado em admin.js e clientes.js.
// Aqui só decidimos o que MOSTRAR — quem realmente autoriza são as functions
// em api/, que checam a mesma matriz (lib/permissions.js) no servidor.

import { supabase, getAccessToken } from "../libs/supabase-client.js"
import { apiConfig } from "../services/api-config.js"

// fetch autenticado: anexa o token da sessão do Supabase.
export async function authFetch(path, options = {}) {
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

// Carrega { email, role, capabilities } ou null se não houver sessão válida.
export async function loadSession() {
    const token = await getAccessToken()
    if (!token) return null

    const response = await authFetch("/me")
    if (!response.ok) return null

    return await response.json()
}

export function can(session, capability) {
    return Boolean(session?.capabilities?.includes(capability))
}

// Guarda de página: exige sessão e uma capacidade.
// Sem sessão manda para o login; com sessão mas sem acesso, avisa e volta —
// sem deslogar, porque o usuário pode ter acesso legítimo a outra página.
export async function requireCapability(capability) {
    const session = await loadSession()

    if (!session) {
        window.location.href = "login.html"
        return null
    }

    if (!can(session, capability)) {
        alert("Você não tem acesso a esta página.")
        window.location.href = can(session, "booking:read_all")
            ? "admin.html"
            : "minha-conta.html"
        return null
    }

    return session
}

export { supabase }
