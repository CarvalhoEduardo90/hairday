const { supabase } = require("../lib/supabase")

module.exports = async function handler(req, res) {
    try {
        if (req.method !== "GET") {
            res.setHeader("Allow", "GET")
            return res.status(405).json({ error: "Metodo nao permitido." })
        }

        const { data, error } = await supabase
            .from("services")
            .select("id, name, price_cents, duration_minutes")
            .eq("active", true)
            .order("name", { ascending: true })

        if (error) {
            console.error(error)
            return res.status(500).json({ error: "Erro ao buscar servicos." })
        }

        return res.status(200).json(
            data.map((service) => ({
                id: service.id,
                name: service.name,
                priceCents: service.price_cents,
                durationMinutes: service.duration_minutes,
            }))
        )
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Erro interno no servidor." })
    }
}
