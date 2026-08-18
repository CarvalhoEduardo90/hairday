// Notificações por WhatsApp via Z-API (https://z-api.io).
//
// Best-effort, igual ao e-mail: se as credenciais não estiverem configuradas,
// ou se o envio falhar, apenas registra no log e NÃO interrompe o agendamento.
//
// Configuração (.env):
//   ZAPI_INSTANCE_ID     -> ID da instância
//   ZAPI_INSTANCE_TOKEN  -> token da instância
//   ZAPI_CLIENT_TOKEN    -> "Account Security Token" (header Client-Token)
//   WHATSAPP_COUNTRY_CODE -> DDI, padrão "55" (Brasil)

const dayjs = require("dayjs")
const utc = require("dayjs/plugin/utc")
const timezone = require("dayjs/plugin/timezone")
require("dayjs/locale/pt-br")

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.locale("pt-br")

const TZ = process.env.BARBERSHOP_TZ || "America/Sao_Paulo"
const SHOP_NAME = process.env.SHOP_NAME || "Piquet Barbearia"
const COUNTRY_CODE = (process.env.WHATSAPP_COUNTRY_CODE || "55").replace(/\D/g, "")

const INSTANCE_ID = process.env.ZAPI_INSTANCE_ID
const INSTANCE_TOKEN = process.env.ZAPI_INSTANCE_TOKEN
const CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN

function isConfigured() {
    return Boolean(INSTANCE_ID && INSTANCE_TOKEN)
}

// Normaliza o telefone para o formato internacional só com dígitos.
// Ex.: "(11) 99999-8888" -> "5511999998888".
function normalizePhone(phone) {
    const digits = String(phone || "").replace(/\D/g, "")
    if (!digits) return null
    // Até 11 dígitos = número local (DDD + número) -> acrescenta o DDI.
    if (digits.length <= 11) return `${COUNTRY_CODE}${digits}`
    return digits
}

function formatWhen(when) {
    return dayjs(when).tz(TZ).format("dddd, DD/MM/YYYY [às] HH:mm")
}

async function sendText({ phone, message }) {
    if (!isConfigured()) {
        console.warn("[whatsapp] Z-API não configurado — mensagem não enviada.")
        return { skipped: true }
    }

    const to = normalizePhone(phone)
    if (!to) {
        console.warn("[whatsapp] telefone inválido — mensagem não enviada.")
        return { skipped: true }
    }

    try {
        const url = `https://api.z-api.io/instances/${INSTANCE_ID}/token/${INSTANCE_TOKEN}/send-text`
        const headers = { "Content-Type": "application/json" }
        if (CLIENT_TOKEN) headers["Client-Token"] = CLIENT_TOKEN

        const response = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify({ phone: to, message }),
        })

        if (!response.ok) {
            const body = await response.text().catch(() => "")
            console.error("[whatsapp] falha no envio:", response.status, body)
            return { error: true }
        }

        return { sent: true }
    } catch (error) {
        console.error("[whatsapp] erro inesperado:", error)
        return { error }
    }
}

async function sendConfirmationWhatsApp({ name, phone, when }) {
    const message =
        `Olá, ${name}! ✅\n\n` +
        `Seu agendamento na ${SHOP_NAME} foi *confirmado* para:\n` +
        `📅 ${formatWhen(when)}.\n\n` +
        `Até lá!`
    return sendText({ phone, message })
}

async function sendCancellationWhatsApp({ name, phone, when }) {
    const message =
        `Olá, ${name}. ❌\n\n` +
        `Seu agendamento na ${SHOP_NAME} de ${formatWhen(when)} foi *cancelado*.\n\n` +
        `Se quiser, é só agendar um novo horário.`
    return sendText({ phone, message })
}

async function sendRescheduleWhatsApp({ name, phone, when }) {
    const message =
        `Olá, ${name}! 🔄\n\n` +
        `Seu agendamento na ${SHOP_NAME} foi *remarcado* para:\n` +
        `📅 ${formatWhen(when)}.\n\n` +
        `Até lá!`
    return sendText({ phone, message })
}

module.exports = {
    sendConfirmationWhatsApp,
    sendCancellationWhatsApp,
    sendRescheduleWhatsApp,
}
