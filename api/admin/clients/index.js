const { supabase } = require("../../../lib/supabase")
const { requireAdmin } = require("../../../lib/auth")
const { getAccountEmails, categorize } = require("../../../lib/accounts")

// /api/admin/clients
//   GET (admin) -> lista todos os clientes com a categoria
//   (avulso / cadastrado / assinante).
module.exports = async function handler(req, res) {
    try {
        if (req.method !== "GET") {
            res.setHeader("Allow", "GET")
            return res.status(405).json({ error: "Método não permitido." })
        }

        const auth = await requireAdmin(req, res)
        if (!auth) return

        const { data, error } = await supabase
            .from("clients")
            .select("id, full_name, email, phone, is_subscriber, created_at")
            .order("full_name", { ascending: true })

        if (error) {
            console.error(error)
            return res.status(500).json({ error: "Erro ao buscar clientes." })
        }

        const accountEmails = await getAccountEmails()

        const clients = data.map((c) => ({
            id: c.id,
            name: c.full_name,
            email: c.email,
            phone: c.phone,
            isSubscriber: c.is_subscriber,
            hasAccount: accountEmails.has((c.email || "").toLowerCase()),
            category: categorize(c, accountEmails),
        }))

        return res.status(200).json(clients)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Erro interno no servidor." })
    }
}
