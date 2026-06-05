const dayjs = require("dayjs")
const { supabase } = require("../../lib/supabase")
const { requireAdmin } = require("../../lib/auth")
const { getAccountEmails, categorize } = require("../../lib/accounts")

// /api/admin/appointments?date=YYYY-MM-DD
//   GET (admin) -> lista completa dos agendamentos do dia, COM nome/contato.
module.exports = async function handler(req, res) {
    try {
        if (req.method !== "GET") {
            res.setHeader("Allow", "GET")
            return res.status(405).json({ error: "Método não permitido." })
        }

        const auth = await requireAdmin(req, res)
        if (!auth) return

        const { date } = req.query
        if (!date || Number.isNaN(new Date(date).getTime())) {
            return res.status(400).json({ error: "Parâmetro 'date' inválido." })
        }

        const start = dayjs(date).startOf("day").toISOString()
        const end = dayjs(date).endOf("day").toISOString()

        const { data, error } = await supabase
            .from("appointments")
            .select("id, when_at, clients ( full_name, email, phone, is_subscriber )")
            .gte("when_at", start)
            .lte("when_at", end)
            .eq("status", "confirmed")
            .order("when_at", { ascending: true })

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
