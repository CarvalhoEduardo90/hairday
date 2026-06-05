"use strict"

import "./libs/dayjs.js"
import "./styles/global.css"
import "./styles/form.css"

import { supabase, getAccessToken } from "./libs/supabase-client.js"
import { apiConfig } from "./services/api-config.js"
import { isValidEmail, isValidPhone } from "./utils/validation.js"
import { privacyPolicy, termsOfUse } from "./legal.js"

const form = document.getElementById("login-form")
const fullnameInput = document.getElementById("fullname")
const emailInput = document.getElementById("email")
const phoneInput = document.getElementById("phone")
const passwordInput = document.getElementById("password")
const button = document.getElementById("submit-button")
const title = document.getElementById("form-title")
const subtitle = document.getElementById("form-subtitle")
const toggleText = document.getElementById("toggle-text")
const toggleLink = document.getElementById("toggle-mode")
const signupFields = document.querySelectorAll(".signup-only")
const signinFields = document.querySelectorAll(".signin-only")
const acceptCheckbox = document.getElementById("accept-terms")

// "signin" ou "signup"
let mode = "signin"

function applyMode() {
    // Alterna o que aparece em cada modo:
    // - signup-only: nome, telefone e o checkbox de aceite (só no cadastro)
    // - signin-only: o texto de aceite implícito (só no login)
    signupFields.forEach((el) => {
        // data-display permite que o checkbox use "flex" e os campos "block".
        el.style.display =
            mode === "signup" ? el.dataset.display || "block" : "none"
    })
    signinFields.forEach((el) => {
        el.style.display = mode === "signin" ? "block" : "none"
    })

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

// ===== Modal (Política de Privacidade / Termos de Uso) =====
const modal = document.getElementById("modal")
const modalTitle = document.getElementById("modal-title")
const modalBody = document.getElementById("modal-body")
const modalClose = document.getElementById("modal-close")

function openModal({ title, html }) {
    modalTitle.textContent = title
    modalBody.innerHTML = html
    modal.hidden = false
}

function closeModal() {
    modal.hidden = true
}

// Cada link legal (.legal-link) abre o documento indicado em data-doc.
// stopPropagation evita marcar o checkbox quando o link está dentro do label.
document.querySelectorAll(".legal-link").forEach((btn) => {
    btn.addEventListener("click", (event) => {
        event.preventDefault()
        event.stopPropagation()
        openModal(btn.dataset.doc === "terms" ? termsOfUse : privacyPolicy)
    })
})

modalClose.addEventListener("click", closeModal)
// Fecha ao clicar no fundo (fora do card).
modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal()
})
// Fecha com a tecla ESC.
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) closeModal()
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
            // Cadastro: valida nome e telefone (além de e-mail/senha).
            const fullName = fullnameInput.value.trim()
            const phone = phoneInput.value.trim()

            if (!fullName) {
                throw new Error("Informe seu nome completo.")
            }
            if (!isValidEmail(email)) {
                throw new Error("Informe um e-mail válido.")
            }
            if (!isValidPhone(phone)) {
                throw new Error("Informe um telefone válido (10 ou 11 dígitos).")
            }
            if (!acceptCheckbox.checked) {
                throw new Error(
                    "É necessário aceitar a Política de Privacidade e os Termos de Uso."
                )
            }

            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                // Vai para o trigger que cria o registro de cliente.
                options: { data: { full_name: fullName, phone } },
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
