import dayjs from "dayjs"

import { scheduleNew } from "../../services/schedule-new.js"
import { schedulesDay } from "../schedules/load.js"
import { isValidEmail, isValidPhone } from "../../utils/validation.js"

const form = document.querySelector("form")
const clientName = document.getElementById("client")
const clientEmail = document.getElementById("email")
const clientPhone = document.getElementById("phone")
const selectedDate = document.getElementById("date")
const submitButton = form.querySelector("button[type='submit']")

// Data atual formatada para o formato "YYYY-MM-DD" no input de data
const inputToday = dayjs(new Date()).format("YYYY-MM-DD")

// Carregar a data atual e define a data mínima do input para a data atual
selectedDate.value = inputToday
selectedDate.min = inputToday

form.onsubmit = async (event) => {
    // Prevenir o comportamento padrão do formulário
    event.preventDefault()

    // Recupera e valida os dados do cliente.
    const name = clientName.value.trim()
    const email = clientEmail.value.trim()
    const phone = clientPhone.value.trim()

    if (!name) {
        return alert("Por favor, insira o nome completo do cliente.")
    }
    if (!isValidEmail(email)) {
        return alert("Por favor, insira um e-mail válido.")
    }
    if (!isValidPhone(phone)) {
        return alert("Por favor, insira um telefone válido (10 ou 11 dígitos).")
    }

    // Recupera o horário selecionado.
    const hoursSelected = document.querySelector(".hour-selected")
    if (!hoursSelected) {
        return alert("Por favor, selecione um horário.")
    }

    // Recupera somente a hora e insere na data selecionada.
    const [hour] = hoursSelected.innerText.split(":")
    const when = dayjs(selectedDate.value).add(Number(hour), "hour").toISOString()

    // Evita envio duplicado enquanto a requisição está em andamento.
    submitButton.disabled = true

    try {
        // Faz o agendamento.
        await scheduleNew({ name, email, phone, when })

        // Exibe uma mensagem de sucesso para o usuário.
        alert("Agendamento realizado com sucesso!")

        // Recarrega os agendamentos e limpa o formulário.
        await schedulesDay()
        form.reset()
        selectedDate.value = inputToday
    } catch (error) {
        console.log(error)
        alert(error.message || "Não foi possível realizar o agendamento.")
    } finally {
        submitButton.disabled = false
    }
}
