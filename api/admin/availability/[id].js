const { supabase } = require("../../../lib/supabase")
const { requireAdmin } = require("../../../lib/auth")

module.exports = async function handler(req, res) {
    try {
        const auth = await requireAdmin(req, res)
        if (!auth) return

        if (req.method !== "PATCH") {
            res.setHeader("Allow", "PATCH")
            return res.status(405).json({ error: "Metodo nao permitido." })
        }

        const { id } = req.query
        if (!id) {
            return res.status(400).json({ error: "Bloqueio invalido." })
        }

        const { data, error } = await supabase
            .from("schedule_blocks")
            .update({ active: false })
            .eq("id", id)
            .select("id")
            .single()

        if (error) {
            console.error(error)
            return res.status(500).json({ error: "Erro ao desativar bloqueio." })
        }

        return res.status(200).json({ id: data.id })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Erro interno no servidor." })
    }
}
