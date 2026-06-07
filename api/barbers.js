const { supabase } = require("../lib/supabase")

module.exports = async function handler(req, res) {
    try {
        if (req.method !== "GET") {
            res.setHeader("Allow", "GET")
            return res.status(405).json({ error: "Metodo nao permitido." })
        }

        const { data, error } = await supabase
            .from("barbers")
            .select("id, name")
            .eq("active", true)
            .order("name", { ascending: true })

        if (error) {
            console.error(error)
            return res.status(500).json({ error: "Erro ao buscar barbeiros." })
        }

        return res.status(200).json(data.map((barber) => ({
            id: barber.id,
            name: barber.name,
        })))
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Erro interno no servidor." })
    }
}
