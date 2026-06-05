const { supabase } = require("../lib/supabase")
const { requireAuth } = require("../lib/auth")

// /api/my-appointments
//   GET -> TODOS os agendamentos do cliente autenticado (confirmados e
//   cancelados, passados e futuros). O front separa em "Próximos" e
//   "Histórico". O vínculo é feito pelo e-mail.
module.exports = async function handler(req, res) {
    try {
        if (req.method !== "GET") {
            res.setHeader("Allow", "GET")
            return res.status(405).json({ error: "Método não permitido." })
        }

        const auth = await requireAuth(req, res)
        if (!auth) return

        // Localiza o cliente pelo e-mail do usuário logado.
        const { data: client, error: clientError } = await supabase
            .from("clients")
            .select("id")
            .eq("email", auth.email)
            .maybeSingle()

        if (clientError) {
            console.error(clientError)
            return res.status(500).json({ error: "Erro ao buscar seus dados." })
        }

        // Sem cadastro de cliente ainda = sem agendamentos.
        if (!client) {
            return res.status(200).json([])
        }

        const { data, error } = await supabase
            .from("appointments")
            .select("id, when_at, status")
            .eq("client_id", client.id)
            .order("when_at", { ascending: false })

        if (error) {
            console.error(error)
            return res.status(500).json({ error: "Erro ao buscar seus agendamentos." })
        }

        const schedules = data.map((row) => ({
            id: row.id,
            when: row.when_at,
            status: row.status,
        }))
        return res.status(200).json(schedules)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Erro interno no servidor." })
    }
}
