// Validações compartilhadas pelas Serverless Functions.

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isValidEmail(email) {
    return typeof email === "string" && EMAIL_REGEX.test(email.trim())
}

// Aceita telefones com 10 ou 11 dígitos (fixo/celular BR), ignorando máscara.
function isValidPhone(phone) {
    if (typeof phone !== "string") return false
    const digits = phone.replace(/\D/g, "")
    return digits.length >= 10 && digits.length <= 11
}

// Valida os dados de um novo agendamento. Retorna { valid, error }.
function validateAppointmentInput({ fullName, email, phone, when }) {
    if (!fullName || !fullName.trim()) {
        return { valid: false, error: "Informe o nome completo do cliente." }
    }
    if (!isValidEmail(email)) {
        return { valid: false, error: "Informe um e-mail válido." }
    }
    if (!isValidPhone(phone)) {
        return { valid: false, error: "Informe um telefone válido (10 ou 11 dígitos)." }
    }
    if (!when || Number.isNaN(new Date(when).getTime())) {
        return { valid: false, error: "Data/horário do agendamento inválido." }
    }
    return { valid: true }
}

module.exports = { isValidEmail, isValidPhone, validateAppointmentInput }
