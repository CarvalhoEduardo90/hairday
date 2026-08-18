const dayjs = require("dayjs")
const { supabase } = require("../../lib/supabase")
const { requireCapability } = require("../../lib/auth")
const { getAccountEmails, categorize } = require("../../lib/accounts")

module.exports = async function handler(req, res) {
    try {
        if (req.method !== "GET") {
            res.setHeader("Allow", "GET")
            return res.status(405).json({ error: "Metodo nao permitido." })
        }

        const auth = await requireCapability(req, res, "booking:read_all")
        if (!auth) return

        const { start, end, error: dateError } = getDateRange(req.query)

        if (dateError) {
            return res.status(400).json({ error: dateError })
        }

        let { data, error } = await fetchAppointments({
            start,
            end,
            includeOptions: true,
        })

        if (error && isMissingAppointmentOptionColumn(error)) {
            const fallback = await fetchAppointments({
                start,
                end,
                includeOptions: false,
            })
            data = fallback.data
            error = fallback.error
        }

        if (error) {
            console.error(error)
            return res.status(500).json({ error: "Erro ao buscar agendamentos." })
        }

        const accountEmails = await getAccountEmails()

        const schedules = data.map((row) => ({
            id: row.id,
            when: row.when_at,
            name: row.clients?.full_name ?? "",
            email: row.clients?.email ?? "",
            phone: row.clients?.phone ?? "",
            serviceName: row.service_name ?? "",
            servicePriceCents: row.service_price_cents ?? null,
            barberName: row.barber_name ?? "",
            category: categorize(
                {
                    email: row.clients?.email,
                    is_subscriber: row.clients?.is_subscriber,
                },
                accountEmails
            ),
        }))

        return res.status(200).json(schedules)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Erro interno no servidor." })
    }
}

function getDateRange(query) {
    if (query.date && !Number.isNaN(new Date(query.date).getTime())) {
        return {
            start: dayjs(query.date).startOf("day").toISOString(),
            end: dayjs(query.date).endOf("day").toISOString(),
            error: null,
        }
    }

    if (
        query.start &&
        query.end &&
        !Number.isNaN(new Date(query.start).getTime()) &&
        !Number.isNaN(new Date(query.end).getTime())
    ) {
        const startDate = dayjs(query.start).startOf("day")
        const endDate = dayjs(query.end).endOf("day")

        if (endDate.isBefore(startDate)) {
            return {
                start: null,
                end: null,
                error: "Periodo invalido: a data final deve ser maior ou igual a inicial.",
            }
        }

        return {
            start: startDate.toISOString(),
            end: endDate.toISOString(),
            error: null,
        }
    }

    return { start: null, end: null, error: "Periodo invalido." }
}

function fetchAppointments({ start, end, includeOptions }) {
    const optionFields = includeOptions
        ? ", service_name, service_price_cents, barber_name"
        : ""

    return supabase
        .from("appointments")
        .select(
            `id, when_at${optionFields}, clients ( full_name, email, phone, is_subscriber )`
        )
        .gte("when_at", start)
        .lte("when_at", end)
        .eq("status", "confirmed")
        .order("when_at", { ascending: true })
}

function isMissingAppointmentOptionColumn(error) {
    return (
        error?.code === "42703" ||
        error?.code === "PGRST204" ||
        /service_|barber_/i.test(error?.message || "")
    )
}
