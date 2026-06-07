const { getDailyAvailability } = require("../lib/availability")

module.exports = async function handler(req, res) {
    try {
        if (req.method !== "GET") {
            res.setHeader("Allow", "GET")
            return res.status(405).json({ error: "Metodo nao permitido." })
        }

        const { date, barberId = "" } = req.query

        if (!date || Number.isNaN(new Date(date).getTime())) {
            return res.status(400).json({ error: "Parametro 'date' invalido." })
        }

        const hours = await getDailyAvailability({ date, barberId })
        return res.status(200).json({ hours })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Erro ao buscar disponibilidade." })
    }
}
