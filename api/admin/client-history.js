const { supabase } = require("../../lib/supabase")
const { requireAdmin } = require("../../lib/auth")

// /api/admin/client-history?clientId=<uuid>
//   GET (admin) -> TODOS os agendamentos de um cliente (confirmados e
//   cancelados, passados e futuros), mais recentes primeiro.
module.exports = async function handler(req, res) {
    try {
        if (req.method !== "GET") {
            res.setHeader("Allow", "GET")
            return res.status(405).json({ error: "Método não permitido." })
        }

        const auth = await requireAdmin(req, res)
        if (!auth) return

        const { clientId } = req.query
        if (!clientId) {
            return res.status(400).json({ error: "Parâmetro 'clientId' obrigatório." })
        }

        const { data, error } = await supabase
            .from("appointments")
            .select("id, when_at, status")
            .eq("client_id", clientId)
            .order("when_at", { ascending: false })

        if (error) {
            console.error(error)
            return res.status(500).json({ error: "Erro ao buscar o histórico." })
        }

        const history = data.map((row) => ({
            id: row.id,
            when: row.when_at,
            status: row.status,
        }))

        return res.status(200).json(history)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Erro interno no servidor." })
    }
}
