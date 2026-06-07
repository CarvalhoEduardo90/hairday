const dayjs = require("dayjs")
const { supabase } = require("../../lib/supabase")
const { validateAppointmentInput } = require("../../lib/validation")
const { sendConfirmationEmail } = require("../../lib/email")
const { sendConfirmationWhatsApp } = require("../../lib/whatsapp")
const { isSlotAvailable } = require("../../lib/availability")

// /api/appointments
//   GET  ?date=YYYY-MM-DD&barberId=ID -> lista agendamentos confirmados do dia
//   POST                              -> cria cliente + agendamento
module.exports = async function handler(req, res) {
    try {
        if (req.method === "GET") return await list(req, res)
        if (req.method === "POST") return await create(req, res)

        res.setHeader("Allow", "GET, POST")
        return res.status(405).json({ error: "Metodo nao permitido." })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Erro interno no servidor." })
    }
}

function isMissingAppointmentOptionColumn(error) {
    return (
        error?.code === "42P01" ||
        error?.code === "42703" ||
        error?.code === "PGRST204" ||
        /service_|barber_/i.test(error?.message || "")
    )
}

async function list(req, res) {
    const { date, barberId } = req.query

    if (!date || Number.isNaN(new Date(date).getTime())) {
        return res.status(400).json({ error: "Parametro 'date' invalido." })
    }

    const start = dayjs(date).startOf("day").toISOString()
    const end = dayjs(date).endOf("day").toISOString()

    let query = supabase
        .from("appointments")
        .select(barberId ? "when_at, barber_id" : "when_at")
        .gte("when_at", start)
        .lte("when_at", end)
        .eq("status", "confirmed")
        .order("when_at", { ascending: true })

    if (barberId) {
        query = query.or(`barber_id.eq.${barberId},barber_id.is.null`)
    }

    let { data, error } = await query

    if (error && barberId && isMissingAppointmentOptionColumn(error)) {
        const fallback = await supabase
            .from("appointments")
            .select("when_at")
            .gte("when_at", start)
            .lte("when_at", end)
            .eq("status", "confirmed")
            .order("when_at", { ascending: true })

        data = fallback.data
        error = fallback.error
    }

    if (error) {
        console.error(error)
        return res.status(500).json({ error: "Erro ao buscar agendamentos." })
    }

    const schedules = data.map((row) => ({ when: row.when_at }))

    return res.status(200).json(schedules)
}

async function insertAppointment(payload) {
    return supabase
        .from("appointments")
        .insert(payload)
        .select("id, when_at")
        .single()
}

function normalizeDuration(value, fallback = 60) {
    const duration = Number(value)
    return Number.isInteger(duration) && duration > 0 ? duration : fallback
}

async function resolveServiceSnapshot({
    serviceId,
    serviceName,
    servicePriceCents,
    serviceDurationMinutes,
}) {
    const fallback = {
        id: serviceId || null,
        name: serviceName || null,
        priceCents: Number.isFinite(Number(servicePriceCents))
            ? Number(servicePriceCents)
            : null,
        durationMinutes: normalizeDuration(serviceDurationMinutes),
    }

    if (!serviceId) return { valid: true, value: fallback }

    const { data, error } = await supabase
        .from("services")
        .select("id, name, price_cents, duration_minutes, active")
        .eq("id", serviceId)
        .eq("active", true)
        .maybeSingle()

    if (error && isMissingAppointmentOptionColumn(error)) {
        return { valid: true, value: fallback }
    }
    if (error) throw error
    if (!data) {
        return { valid: false, error: "Servico indisponivel para agendamento." }
    }

    return {
        valid: true,
        value: {
            id: data.id,
            name: data.name,
            priceCents: data.price_cents,
            durationMinutes: normalizeDuration(data.duration_minutes),
        },
    }
}

async function create(req, res) {
    const {
        fullName,
        email,
        phone,
        when,
        serviceId,
        serviceName,
        servicePriceCents,
        serviceDurationMinutes,
        barberId,
        barberName,
    } = req.body || {}

    const { valid, error: validationError } = validateAppointmentInput({
        fullName,
        email,
        phone,
        when,
    })
    if (!valid) {
        return res.status(400).json({ error: validationError })
    }

    const service = await resolveServiceSnapshot({
        serviceId,
        serviceName,
        servicePriceCents,
        serviceDurationMinutes,
    })
    if (!service.valid) {
        return res.status(400).json({ error: service.error })
    }

    const available = await isSlotAvailable({
        when,
        barberId: barberId || "",
        serviceDurationMinutes: service.value.durationMinutes,
    })
    if (!available) {
        return res
            .status(409)
            .json({ error: "Este horario nao esta disponivel. Escolha outro." })
    }

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

    const baseAppointment = {
        client_id: client.id,
        when_at: new Date(when).toISOString(),
    }
    const appointmentWithOptions = {
        ...baseAppointment,
        service_id: service.value.id,
        service_name: service.value.name,
        service_price_cents: service.value.priceCents,
        service_duration_minutes: service.value.durationMinutes,
        barber_id: barberId || null,
        barber_name: barberName || null,
    }

    let { data: appointment, error: appointmentError } =
        await insertAppointment(appointmentWithOptions)

    if (appointmentError && isMissingAppointmentOptionColumn(appointmentError)) {
        const fallback = await insertAppointment(baseAppointment)
        appointment = fallback.data
        appointmentError = fallback.error
    }

    if (appointmentError) {
        if (appointmentError.code === "23505") {
            return res
                .status(409)
                .json({ error: "Este horario ja esta reservado. Escolha outro." })
        }
        console.error(appointmentError)
        return res.status(500).json({ error: "Erro ao criar o agendamento." })
    }

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
        serviceName: service.value.name,
        barberName: barberName || null,
    })
}
