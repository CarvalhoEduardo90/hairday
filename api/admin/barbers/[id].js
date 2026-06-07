const { supabase } = require("../../../lib/supabase")
const { requireAdmin } = require("../../../lib/auth")

module.exports = async function handler(req, res) {
    try {
        const auth = await requireAdmin(req, res)
        if (!auth) return

        const id = req.query.id
        if (!id) {
            return res.status(400).json({ error: "Barbeiro invalido." })
        }

        if (req.method === "PATCH") return await update(req, res, id)
        if (req.method === "DELETE") return await disable(req, res, id)

        res.setHeader("Allow", "PATCH, DELETE")
        return res.status(405).json({ error: "Metodo nao permitido." })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Erro interno no servidor." })
    }
}

async function update(req, res, id) {
    const parsed = parseBarberPatch(req.body || {})
    if (!parsed.valid) {
        return res.status(400).json({ error: parsed.error })
    }

    const { data, error } = await supabase
        .from("barbers")
        .update(parsed.value)
        .eq("id", id)
        .select("id, name, phone, active, created_at")
        .single()

    if (error) {
        console.error(error)
        return res.status(500).json({ error: "Erro ao atualizar o barbeiro." })
    }

    return res.status(200).json(toDTO(data))
}

async function disable(req, res, id) {
    const { data, error } = await supabase
        .from("barbers")
        .update({ active: false })
        .eq("id", id)
        .select("id, name, phone, active, created_at")
        .single()

    if (error) {
        console.error(error)
        return res.status(500).json({ error: "Erro ao desativar o barbeiro." })
    }

    return res.status(200).json(toDTO(data))
}

function parseBarberPatch(body) {
    const value = {}

    if ("name" in body) {
        const name = String(body.name || "").trim()
        if (!name) return { valid: false, error: "Informe o nome do barbeiro." }
        value.name = name
    }

    if ("phone" in body) {
        value.phone = String(body.phone || "").trim()
    }

    if ("active" in body) {
        value.active = Boolean(body.active)
    }

    if (Object.keys(value).length === 0) {
        return { valid: false, error: "Nada para atualizar." }
    }

    return { valid: true, value }
}

function toDTO(barber) {
    return {
        id: barber.id,
        name: barber.name,
        phone: barber.phone,
        active: barber.active,
        createdAt: barber.created_at,
    }
}
