const { supabase } = require("../../lib/supabase")
const { requireAuth } = require("../../lib/auth")
const {
    sendCancellationEmail,
    sendRescheduleEmail,
} = require("../../lib/email")
const {
    sendCancellationWhatsApp,
    sendRescheduleWhatsApp,
} = require("../../lib/whatsapp")
const { isSlotAvailable } = require("../../lib/availability")

// /api/appointments/:id
//   DELETE -> cancela (admin OU o cliente dono do agendamento)
//   PATCH  -> remarca o horário (admin OU o dono). body: { when }
module.exports = async function handler(req, res) {
    try {
        if (req.method === "DELETE") return await cancel(req, res)
        if (req.method === "PATCH") return await reschedule(req, res)

        res.setHeader("Allow", "DELETE, PATCH")
        return res.status(405).json({ error: "Método não permitido." })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Erro interno no servidor." })
    }
}

// Carrega o agendamento confirmado e garante que o usuário tem permissão
// (admin ou dono). Retorna o agendamento ou null (já tendo respondido o erro).
function isMissingAppointmentOptionColumn(error) {
    return (
        error?.code === "42703" ||
        error?.code === "PGRST204" ||
        /barber_|service_/i.test(error?.message || "")
    )
}

function normalizeDuration(value, fallback = 60) {
    const duration = Number(value)
    return Number.isInteger(duration) && duration > 0 ? duration : fallback
}

async function loadAuthorized(req, res) {
    const auth = await requireAuth(req, res)
    if (!auth) return null

    const { id } = req.query

    let { data: appointment, error } = await supabase
        .from("appointments")
        .select(
            "id, when_at, status, barber_id, service_duration_minutes, clients ( full_name, email, phone )"
        )
        .eq("id", id)
        .maybeSingle()

    if (error && isMissingAppointmentOptionColumn(error)) {
        const fallback = await supabase
            .from("appointments")
            .select("id, when_at, status, clients ( full_name, email, phone )")
            .eq("id", id)
            .maybeSingle()

        appointment = fallback.data
        error = fallback.error
    }

    if (error) {
        console.error(error)
        res.status(500).json({ error: "Erro ao buscar o agendamento." })
        return null
    }

    if (!appointment || appointment.status !== "confirmed") {
        res.status(404).json({ error: "Agendamento não encontrado ou já cancelado." })
        return null
    }

    const ownerEmail = (appointment.clients?.email || "").toLowerCase()
    if (!auth.isAdmin && ownerEmail !== auth.email) {
        res.status(403).json({ error: "Você não pode gerenciar este agendamento." })
        return null
    }

    return appointment
}

async function cancel(req, res) {
    const appointment = await loadAuthorized(req, res)
    if (!appointment) return

    const { error } = await supabase
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("id", appointment.id)
        .eq("status", "confirmed")

    if (error) {
        console.error(error)
        return res.status(500).json({ error: "Erro ao cancelar o agendamento." })
    }

    const client = appointment.clients
    if (client?.email) {
        await sendCancellationEmail({
            id: appointment.id,
            name: client.full_name,
            email: client.email,
            when: appointment.when_at,
        })
    }
    if (client?.phone) {
        await sendCancellationWhatsApp({
            name: client.full_name,
            phone: client.phone,
            when: appointment.when_at,
        })
    }

    return res.status(200).json({ id: appointment.id })
}

async function reschedule(req, res) {
    const appointment = await loadAuthorized(req, res)
    if (!appointment) return

    const { when } = req.body || {}
    if (!when || Number.isNaN(new Date(when).getTime())) {
        return res.status(400).json({ error: "Novo horário inválido." })
    }

    const available = await isSlotAvailable({
        when,
        barberId: appointment.barber_id || "",
        excludeAppointmentId: appointment.id,
        serviceDurationMinutes: normalizeDuration(
            appointment.service_duration_minutes
        ),
    })
    if (!available) {
        return res
            .status(409)
            .json({ error: "Este horario nao esta disponivel. Escolha outro." })
    }

    const { data, error } = await supabase
        .from("appointments")
        .update({ when_at: new Date(when).toISOString() })
        .eq("id", appointment.id)
        .eq("status", "confirmed")
        .select("id, when_at")

    if (error) {
        // 23505 = unique_violation -> novo horário já está ocupado.
        if (error.code === "23505") {
            return res
                .status(409)
                .json({ error: "Este horário já está reservado. Escolha outro." })
        }
        console.error(error)
        return res.status(500).json({ error: "Erro ao remarcar o agendamento." })
    }

    if (!data || data.length === 0) {
        return res
            .status(404)
            .json({ error: "Agendamento não encontrado ou já cancelado." })
    }

    const client = appointment.clients
    if (client?.email) {
        await sendRescheduleEmail({
            id: appointment.id,
            name: client.full_name,
            email: client.email,
            when: data[0].when_at,
        })
    }
    if (client?.phone) {
        await sendRescheduleWhatsApp({
            name: client.full_name,
            phone: client.phone,
            when: data[0].when_at,
        })
    }

    return res.status(200).json({ id: appointment.id, when: data[0].when_at })
}
