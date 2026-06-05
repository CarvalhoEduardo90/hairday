"use strict"

import "./styles/global.css"
import "./styles/form.css"

import { supabase } from "./libs/supabase-client.js"

const form = document.getElementById("password-form")
const passwordInput = document.getElementById("password")
const confirmPasswordInput = document.getElementById("confirm-password")
const button = document.getElementById("submit-button")
const statusMessage = document.getElementById("status-message")

function setStatus(message, type = "") {
    statusMessage.textContent = message
    statusMessage.classList.toggle("error", type === "error")
    statusMessage.classList.toggle("success", type === "success")
}

function showForm() {
    form.hidden = false
    setStatus("Informe e confirme sua nova senha.")
}

function cleanAuthParamsFromUrl() {
    window.history.replaceState({}, document.title, window.location.pathname)
}

function getAuthErrorFromUrl() {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""))
    const search = new URLSearchParams(window.location.search)
    const error =
        hash.get("error_description") ||
        hash.get("error") ||
        search.get("error_description") ||
        search.get("error")

    return error ? decodeURIComponent(error.replace(/\+/g, " ")) : null
}

function getFriendlyError(error) {
    const message = (error?.message || String(error || "")).toLowerCase()

    if (
        message.includes("expired") ||
        message.includes("invalid") ||
        message.includes("otp") ||
        message.includes("token") ||
        message.includes("missing")
    ) {
        return "Link expirado, invalido ou ja utilizado. Peca um novo convite ou link de acesso."
    }

    if (
        message.includes("weak") ||
        message.includes("password") ||
        message.includes("senha")
    ) {
        return "Senha fraca. Use uma senha maior e mais dificil de adivinhar."
    }

    return "Nao foi possivel salvar sua senha. Tente novamente."
}

async function waitForInviteSession() {
    const urlError = getAuthErrorFromUrl()
    if (urlError) {
        throw new Error(urlError)
    }

    const params = new URLSearchParams(window.location.search)
    const code = params.get("code")

    if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
            const { data } = await supabase.auth.getSession()
            if (!data.session) throw error
        }
        cleanAuthParamsFromUrl()
    }

    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    if (data.session) {
        cleanAuthParamsFromUrl()
        return data.session
    }

    await new Promise((resolve) => setTimeout(resolve, 500))

    const { data: retryData, error: retryError } = await supabase.auth.getSession()
    if (retryError) throw retryError
    if (!retryData.session) {
        throw new Error("invite session missing")
    }

    cleanAuthParamsFromUrl()
    return retryData.session
}

form.addEventListener("submit", async (event) => {
    event.preventDefault()
    button.disabled = true

    const password = passwordInput.value
    const confirmPassword = confirmPasswordInput.value

    try {
        if (password !== confirmPassword) {
            throw new Error("As senhas nao conferem.")
        }

        if (password.length < 6) {
            throw new Error("Senha fraca.")
        }

        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error

        setStatus("Senha criada com sucesso. Redirecionando para o login...", "success")

        await supabase.auth.signOut()
        window.setTimeout(() => {
            window.location.href = "login.html"
        }, 900)
    } catch (error) {
        if (error.message === "As senhas nao conferem.") {
            setStatus(error.message, "error")
        } else {
            setStatus(getFriendlyError(error), "error")
        }
        button.disabled = false
    }
})

;(async () => {
    try {
        await waitForInviteSession()
        showForm()
    } catch (error) {
        console.error(error)
        form.hidden = true
        setStatus(getFriendlyError(error), "error")
    }
})()
