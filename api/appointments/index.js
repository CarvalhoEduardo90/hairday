const dayjs = require("dayjs")
const { supabase } = require("../../lib/supabase")
const { validateAppointmentInput } = require("../../lib/validation")
const { sendConfirmationEmail } = require("../../lib/email")
const { sendConfirmationWhatsApp } = require("../../lib/whatsapp")

// /api/appointments
//   GET  ?date=YYYY-MM-DD  -> lista agendamentos confirmados do dia
//   POST                   -> cria cliente (upsert) + agendamento
module.exports = async function handler(req, res) {
    try {
        if (req.method === "GET") return await list(req, res)
        if (req.method === "POST") return await create(req, res)

        res.setHeader("Allow", "GET, POST")
        return res.status(405).json({ error: "Método não permitido." })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Erro interno no servidor." })
    }
}

async function list(req, res) {
    const { date } = req.query

    if (!date || Number.isNaN(new Date(date).getTime())) {
        return res.status(400).json({ error: "Parâmetro 'date' inválido." })
    }

    const start = dayjs(date).startOf("day").toISOString()
    const end = dayjs(date).endOf("day").toISOString()

    // Endpoint PÚBLICO: retorna apenas a disponibilidade (horários ocupados),
    // SEM expor nome/contato dos clientes. Os dados completos ficam em
    // /api/admin/appointments (somente administradores).
    const { data, error } = await supabase
        .from("appointments")
        .select("when_at")
        .gte("when_at", start)
        .lte("when_at", end)
        .eq("status", "confirmed")
        .order("when_at", { ascending: true })

    if (error) {
        console.error(error)
        return res.status(500).json({ error: "Erro ao buscar agendamentos." })
    }

    const schedules = data.map((row) => ({ when: row.when_at }))

    return res.status(200).json(schedules)
}

async function create(req, res) {
    const { fullName, email, phone, when } = req.body || {}

    const { valid, error: validationError } = validateAppointmentInput({
        fullName,
        email,
        phone,
        when,
    })
    if (!valid) {
        return res.status(400).json({ error: validationError })
    }

    // Upsert do cliente pelo e-mail (atualiza nome/telefone se já existir).
    const { data: client, error: clientError } = await supabase
        .from("clients")
        .upsert(
            {
                full_name: fullName.trim(),
                email: email.trim().toLowerCase(),
                phone: phone.trim(),
            },
            { onConflict: "email" }
        )
        .select("id")
        .single()

    if (clientError) {
        console.error(clientError)
        return res.status(500).json({ error: "Erro ao salvar os dados do cliente." })
    }

    // Cria o agendamento. O índice único no banco impede conflito de horário.
    const { data: appointment, error: appointmentError } = await supabase
        .from("appointments")
        .insert({
            client_id: client.id,
            when_at: new Date(when).toISOString(),
        })
        .select("id, when_at")
        .single()

    if (appointmentError) {
        // 23505 = unique_violation -> horário já reservado.
        if (appointmentError.code === "23505") {
            return res
                .status(409)
                .json({ error: "Este horário já está reservado. Escolha outro." })
        }
        console.error(appointmentError)
        return res.status(500).json({ error: "Erro ao criar o agendamento." })
    }

    // Notificações de confirmação (best-effort: não falham o agendamento).
    await sendConfirmationEmail({
        id: appointment.id,
        name: fullName.trim(),
        email: email.trim().toLowerCase(),
        when: appointment.when_at,
    })
    await sendConfirmationWhatsApp({
        name: fullName.trim(),
        phone: phone.trim(),
        when: appointment.when_at,
    })

    return res.status(201).json({
        id: appointment.id,
        when: appointment.when_at,
        name: fullName.trim(),
    })
}
