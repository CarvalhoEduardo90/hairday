const { supabase } = require("../../../lib/supabase")
const { requireAdmin } = require("../../../lib/auth")

// /api/admin/clients/:id
//   PATCH (admin) -> marca/desmarca o cliente como assinante.
//   body: { isSubscriber: boolean }
module.exports = async function handler(req, res) {
    try {
        if (req.method !== "PATCH") {
            res.setHeader("Allow", "PATCH")
            return res.status(405).json({ error: "Método não permitido." })
        }

        const auth = await requireAdmin(req, res)
        if (!auth) return

        const { id } = req.query
        const { isSubscriber } = req.body || {}

        if (typeof isSubscriber !== "boolean") {
            return res
                .status(400)
                .json({ error: "Campo 'isSubscriber' deve ser true ou false." })
        }

        const { data, error } = await supabase
            .from("clients")
            .update({ is_subscriber: isSubscriber })
            .eq("id", id)
            .select("id, is_subscriber")

        if (error) {
            console.error(error)
            return res.status(500).json({ error: "Erro ao atualizar o cliente." })
        }

        if (!data || data.length === 0) {
            return res.status(404).json({ error: "Cliente não encontrado." })
        }

        return res.status(200).json({
            id: data[0].id,
            isSubscriber: data[0].is_subscriber,
        })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Erro interno no servidor." })
    }
}
