// Serviço de e-mail transacional via Resend.
// Envia confirmação, cancelamento e reagendamento, com convite .ics anexado.
//
// É "best-effort": se o RESEND_API_KEY não estiver configurado, ou se o envio
// falhar, apenas registra no log e NÃO interrompe o agendamento.

const { Resend } = require("resend")
const dayjs = require("dayjs")
const utc = require("dayjs/plugin/utc")
const timezone = require("dayjs/plugin/timezone")
require("dayjs/locale/pt-br")
const { buildICS } = require("./ics")

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.locale("pt-br")

// Fuso da barbearia para exibir o horário corretamente (banco guarda em UTC).
const TZ = process.env.BARBERSHOP_TZ || "America/Sao_Paulo"
const SHOP_NAME = process.env.SHOP_NAME || "Hair Day"
const FROM = process.env.MAIL_FROM
const REPLY_TO = process.env.MAIL_REPLY_TO || undefined

function getResend() {
    if (!process.env.RESEND_API_KEY || !FROM) {
        console.warn(
            "[email] RESEND_API_KEY/MAIL_FROM ausentes — e-mail não enviado."
        )
        return null
    }
    return new Resend(process.env.RESEND_API_KEY)
}

function formatWhen(when) {
    return dayjs(when).tz(TZ).format("dddd, DD/MM/YYYY [às] HH:mm")
}

function baseHtml(title, bodyHtml) {
    return `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
      <h2 style="color: #6d28d9;">${SHOP_NAME}</h2>
      <h3>${title}</h3>
      ${bodyHtml}
      <p style="font-size: 12px; color: #6b7280; margin-top: 24px;">
        Este é um e-mail automático, não é necessário responder.
      </p>
    </div>`
}

// Envia o e-mail capturando erros para não quebrar o fluxo do agendamento.
async function send({ to, subject, html, ics }) {
    const resend = getResend()
    if (!resend) return { skipped: true }

    try {
        const message = { from: FROM, to, subject, html }
        if (REPLY_TO) message.replyTo = REPLY_TO
        if (ics) {
            message.attachments = [
                {
                    filename: "agendamento.ics",
                    content: Buffer.from(ics).toString("base64"),
                },
            ]
        }

        const { error } = await resend.emails.send(message)
        if (error) {
            console.error("[email] falha no envio:", error)
            return { error }
        }
        return { sent: true }
    } catch (error) {
        console.error("[email] erro inesperado:", error)
        return { error }
    }
}

async function sendConfirmationEmail({ id, name, email, when }) {
    const quando = formatWhen(when)
    const ics = buildICS({
        id,
        summary: `Atendimento na ${SHOP_NAME}`,
        description: `Agendamento de ${name} na ${SHOP_NAME}.`,
        start: when,
        method: "REQUEST",
        organizerName: SHOP_NAME,
        organizerEmail: REPLY_TO,
    })

    return send({
        to: email,
        subject: `Agendamento confirmado — ${SHOP_NAME}`,
        html: baseHtml(
            "Agendamento confirmado ✅",
            `<p>Olá, <strong>${name}</strong>!</p>
             <p>Seu horário foi confirmado para:</p>
             <p style="font-size: 18px;"><strong>${quando}</strong></p>
             <p>O convite em anexo pode ser adicionado ao seu calendário.</p>`
        ),
        ics,
    })
}

async function sendCancellationEmail({ id, name, email, when }) {
    const quando = formatWhen(when)
    const ics = buildICS({
        id,
        summary: `Atendimento na ${SHOP_NAME}`,
        start: when,
        method: "CANCEL",
        sequence: 1,
        organizerName: SHOP_NAME,
        organizerEmail: REPLY_TO,
    })

    return send({
        to: email,
        subject: `Agendamento cancelado — ${SHOP_NAME}`,
        html: baseHtml(
            "Agendamento cancelado",
            `<p>Olá, <strong>${name}</strong>.</p>
             <p>Seu agendamento de <strong>${quando}</strong> foi cancelado.</p>
             <p>Se desejar, é só agendar um novo horário.</p>`
        ),
        ics,
    })
}

// Usado na Fase 3 (reagendamento). Mantido aqui por reaproveitar o template.
async function sendRescheduleEmail({ id, name, email, when, sequence = 1 }) {
    const quando = formatWhen(when)
    const ics = buildICS({
        id,
        summary: `Atendimento na ${SHOP_NAME}`,
        description: `Agendamento de ${name} na ${SHOP_NAME}.`,
        start: when,
        method: "REQUEST",
        sequence,
        organizerName: SHOP_NAME,
        organizerEmail: REPLY_TO,
    })

    return send({
        to: email,
        subject: `Agendamento remarcado — ${SHOP_NAME}`,
        html: baseHtml(
            "Agendamento remarcado 🔄",
            `<p>Olá, <strong>${name}</strong>!</p>
             <p>Seu horário foi remarcado para:</p>
             <p style="font-size: 18px;"><strong>${quando}</strong></p>
             <p>O convite em anexo atualiza o evento no seu calendário.</p>`
        ),
        ics,
    })
}

module.exports = {
    sendConfirmationEmail,
    sendCancellationEmail,
    sendRescheduleEmail,
}
