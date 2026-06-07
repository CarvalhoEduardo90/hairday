const { supabase } = require("../../../lib/supabase")
const { requireAdmin } = require("../../../lib/auth")

module.exports = async function handler(req, res) {
    try {
        const auth = await requireAdmin(req, res)
        if (!auth) return

        if (req.method === "GET") return await getConfig(req, res)
        if (req.method === "PUT") return await saveWeeklyConfig(req, res)
        if (req.method === "POST") return await createBlock(req, res)

        res.setHeader("Allow", "GET, PUT, POST")
        return res.status(405).json({ error: "Metodo nao permitido." })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Erro interno no servidor." })
    }
}

async function getConfig(req, res) {
    const [hoursResult, breaksResult, blocksResult] = await Promise.all([
        supabase
            .from("business_hours")
            .select("day_of_week, opens_at, closes_at, slot_interval_minutes, active")
            .order("day_of_week", { ascending: true }),
        supabase
            .from("business_breaks")
            .select("id, day_of_week, starts_at, ends_at, active")
            .order("day_of_week", { ascending: true }),
        supabase
            .from("schedule_blocks")
            .select("id, block_date, starts_at, ends_at, barber_id, reason, active")
            .gte("block_date", new Date().toISOString().slice(0, 10))
            .order("block_date", { ascending: true })
            .limit(30),
    ])

    const error = hoursResult.error || breaksResult.error || blocksResult.error
    if (error) {
        console.error(error)
        return res.status(500).json({ error: "Erro ao buscar horarios." })
    }

    return res.status(200).json({
        hours: hoursResult.data.map(toHourDTO),
        breaks: breaksResult.data.map(toBreakDTO),
        blocks: blocksResult.data.map(toBlockDTO),
    })
}

async function saveWeeklyConfig(req, res) {
    const { hours = [], breaks = [] } = req.body || {}

    if (!Array.isArray(hours) || !Array.isArray(breaks)) {
        return res.status(400).json({ error: "Configuracao invalida." })
    }

    const parsedHours = hours.map(parseHour).filter(Boolean)
    const parsedBreaks = breaks.map(parseBreak).filter(Boolean)
    const parsedDays = new Set(parsedHours.map((hour) => hour.day_of_week))

    if (parsedHours.length !== 7 || parsedDays.size !== 7) {
        return res.status(400).json({ error: "Informe os 7 dias da semana." })
    }
    if (parsedBreaks.length !== breaks.length) {
        return res.status(400).json({ error: "Informe pausas validas." })
    }

    const { error: hoursError } = await supabase
        .from("business_hours")
        .upsert(parsedHours, { onConflict: "day_of_week" })

    if (hoursError) {
        console.error(hoursError)
        return res.status(500).json({ error: "Erro ao salvar horario semanal." })
    }

    const { error: deleteBreaksError } = await supabase
        .from("business_breaks")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000")

    if (deleteBreaksError) {
        console.error(deleteBreaksError)
        return res.status(500).json({ error: "Erro ao salvar pausas." })
    }

    if (parsedBreaks.length > 0) {
        const { error: breaksError } = await supabase
            .from("business_breaks")
            .insert(parsedBreaks)

        if (breaksError) {
            console.error(breaksError)
            return res.status(500).json({ error: "Erro ao salvar pausas." })
        }
    }

    return await getConfig(req, res)
}

async function createBlock(req, res) {
    const parsed = parseBlock(req.body || {})
    if (!parsed.valid) {
        return res.status(400).json({ error: parsed.error })
    }

    const { data, error } = await supabase
        .from("schedule_blocks")
        .insert(parsed.value)
        .select("id, block_date, starts_at, ends_at, barber_id, reason, active")
        .single()

    if (error) {
        console.error(error)
        return res.status(500).json({ error: "Erro ao criar bloqueio." })
    }

    return res.status(201).json(toBlockDTO(data))
}

function parseHour(hour = {}) {
    hour = hour || {}
    const day = Number(hour.dayOfWeek)
    const opensAt = normalizeTime(hour.opensAt)
    const closesAt = normalizeTime(hour.closesAt)
    const interval = Number(hour.slotIntervalMinutes || 60)

    if (!Number.isInteger(day) || day < 0 || day > 6) return null
    if (!isValidTime(opensAt) || !isValidTime(closesAt)) return null
    if (opensAt >= closesAt) return null
    if (!Number.isInteger(interval) || interval <= 0) return null

    return {
        day_of_week: day,
        opens_at: opensAt,
        closes_at: closesAt,
        slot_interval_minutes: interval,
        active: Boolean(hour.active),
        updated_at: new Date().toISOString(),
    }
}

function parseBreak(breakItem = {}) {
    breakItem = breakItem || {}
    const day = Number(breakItem.dayOfWeek)
    const startsAt = normalizeTime(breakItem.startsAt)
    const endsAt = normalizeTime(breakItem.endsAt)

    if (!Number.isInteger(day) || day < 0 || day > 6) return null
    if (!isValidTime(startsAt) || !isValidTime(endsAt)) return null
    if (startsAt >= endsAt) return null

    return {
        day_of_week: day,
        starts_at: startsAt,
        ends_at: endsAt,
        active: breakItem.active !== false,
    }
}

function parseBlock(body) {
    const date = String(body.date || "").trim()
    const startsAt = normalizeTime(body.startsAt)
    const endsAt = normalizeTime(body.endsAt)

    if (!date || Number.isNaN(new Date(date).getTime())) {
        return { valid: false, error: "Informe uma data valida." }
    }
    if (!isValidTime(startsAt) || !isValidTime(endsAt)) {
        return { valid: false, error: "Informe horarios validos." }
    }
    if (startsAt >= endsAt) {
        return { valid: false, error: "O fim deve ser maior que o inicio." }
    }

    return {
        valid: true,
        value: {
            block_date: date,
            starts_at: startsAt,
            ends_at: endsAt,
            barber_id: body.barberId || null,
            reason: String(body.reason || "").trim(),
            active: true,
        },
    }
}

function normalizeTime(value) {
    return String(value || "").slice(0, 5)
}

function isValidTime(value) {
    return /^\d{2}:\d{2}$/.test(value)
}

function toHourDTO(hour) {
    return {
        dayOfWeek: hour.day_of_week,
        opensAt: normalizeTime(hour.opens_at),
        closesAt: normalizeTime(hour.closes_at),
        slotIntervalMinutes: hour.slot_interval_minutes,
        active: hour.active,
    }
}

function toBreakDTO(breakItem) {
    return {
        id: breakItem.id,
        dayOfWeek: breakItem.day_of_week,
        startsAt: normalizeTime(breakItem.starts_at),
        endsAt: normalizeTime(breakItem.ends_at),
        active: breakItem.active,
    }
}

function toBlockDTO(block) {
    return {
        id: block.id,
        date: block.block_date,
        startsAt: normalizeTime(block.starts_at),
        endsAt: normalizeTime(block.ends_at),
        barberId: block.barber_id,
        reason: block.reason,
        active: block.active,
    }
}
