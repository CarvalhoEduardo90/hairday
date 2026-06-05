// Validações usadas no formulário do front-end.
// (O back-end revalida os mesmos dados em lib/validation.js.)

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(email) {
    return typeof email === "string" && EMAIL_REGEX.test(email.trim())
}

// Aceita telefones com 10 ou 11 dígitos (fixo/celular BR), ignorando máscara.
export function isValidPhone(phone) {
    if (typeof phone !== "string") return false
    const digits = phone.replace(/\D/g, "")
    return digits.length >= 10 && digits.length <= 11
}
