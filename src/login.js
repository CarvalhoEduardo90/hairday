"use strict"

import "./libs/dayjs.js"
import "./styles/global.css"
import "./styles/form.css"

import { supabase, getAccessToken } from "./libs/supabase-client.js"
import { apiConfig } from "./services/api-config.js"

const form = document.getElementById("login-form")
const emailInput = document.getElementById("email")
const passwordInput = document.getElementById("password")
const button = document.getElementById("submit-button")
const title = document.getElementById("form-title")
const subtitle = document.getElementById("form-subtitle")
const toggleText = document.getElementById("toggle-text")
const toggleLink = document.getElementById("toggle-mode")

// "signin" ou "signup"
let mode = "signin"

function applyMode() {
    if (mode === "signin") {
        title.textContent = "Entrar"
        subtitle.textContent = "Acesse para gerenciar seus agendamentos"
        button.textContent = "Entrar"
        passwordInput.setAttribute("autocomplete", "current-password")
        toggleText.textContent = "Não tem conta?"
        toggleLink.textContent = "Criar conta"
    } else {
        title.textContent = "Criar conta"
        subtitle.textContent = "Cadastre-se para acompanhar seus agendamentos"
        button.textContent = "Cadastrar"
        passwordInput.setAttribute("autocomplete", "new-password")
        toggleText.textContent = "Já tem conta?"
        toggleLink.textContent = "Entrar"
    }
}

toggleLink.addEventListener("click", (event) => {
    event.preventDefault()
    mode = mode === "signin" ? "signup" : "signin"
    applyMode()
})

// Consulta o papel do usuário e redireciona de acordo.
async function redirectByRole() {
    const token = await getAccessToken()
    if (!token) return

    const response = await fetch(`${apiConfig.baseURL}/me`, {
        headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) return

    const me = await response.json()
    window.location.href = me.isAdmin ? "admin.html" : "minha-conta.html"
}

// Se já houver sessão ativa, redireciona direto.
redirectByRole()

form.onsubmit = async (event) => {
    event.preventDefault()
    button.disabled = true

    const email = emailInput.value.trim()
    const password = passwordInput.value

    try {
        if (mode === "signin") {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            })
            if (error) throw new Error("E-mail ou senha inválidos.")
            await redirectByRole()
        } else {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
            })
            if (error) throw new Error(error.message || "Não foi possível cadastrar.")

            // Se a confirmação de e-mail estiver desativada, já vem sessão.
            if (data.session) {
                await redirectByRole()
            } else {
                alert(
                    "Cadastro realizado! Confirme seu e-mail para ativar a conta e depois faça login."
                )
                mode = "signin"
                applyMode()
            }
        }
    } catch (error) {
        console.log(error)
        alert(error.message || "Não foi possível continuar.")
    } finally {
        button.disabled = false
    }
}

applyMode()
