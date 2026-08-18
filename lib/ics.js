// Gera convites de calendário (.ics, RFC 5545) para anexar nos e-mails.
// Compatível com Google Calendar, Apple Calendar e Outlook.

// Converte uma data para o formato UTC do iCalendar: YYYYMMDDTHHMMSSZ.
function formatICSDate(date) {
    return new Date(date)
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, "")
}

// Escapa caracteres especiais conforme a especificação do iCalendar.
function escapeText(text) {
    return String(text)
        .replace(/\\/g, "\\\\")
        .replace(/;/g, "\\;")
        .replace(/,/g, "\\,")
        .replace(/\r?\n/g, "\\n")
}

// method: "REQUEST" (criar/atualizar) ou "CANCEL" (cancelar).
// O UID é derivado do id do agendamento para que o CANCEL atualize o
// mesmo evento já adicionado pelo cliente no calendário.
function buildICS({
    id,
    summary,
    description = "",
    location = "",
    start,
    durationMinutes = 60,
    method = "REQUEST",
    organizerName = "Piquet Barbearia",
    organizerEmail,
    sequence = 0,
}) {
    const dtStart = formatICSDate(start)
    const dtEnd = formatICSDate(
        new Date(new Date(start).getTime() + durationMinutes * 60000)
    )
    const dtStamp = formatICSDate(new Date())
    const status = method === "CANCEL" ? "CANCELLED" : "CONFIRMED"

    const lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Piquet Barbearia//Agendamento//PT-BR",
        "CALSCALE:GREGORIAN",
        `METHOD:${method}`,
        "BEGIN:VEVENT",
        `UID:${id}@hairday`,
        `SEQUENCE:${sequence}`,
        `DTSTAMP:${dtStamp}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `STATUS:${status}`,
        `SUMMARY:${escapeText(summary)}`,
    ]

    if (description) lines.push(`DESCRIPTION:${escapeText(description)}`)
    if (location) lines.push(`LOCATION:${escapeText(location)}`)
    if (organizerEmail) {
        lines.push(
            `ORGANIZER;CN=${escapeText(organizerName)}:mailto:${organizerEmail}`
        )
    }

    lines.push("END:VEVENT", "END:VCALENDAR")

    // O iCalendar exige terminação de linha CRLF.
    return lines.join("\r\n")
}

module.exports = { buildICS }
