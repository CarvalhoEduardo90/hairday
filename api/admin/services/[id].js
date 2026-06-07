const { supabase } = require("../../../lib/supabase")
const { requireAdmin } = require("../../../lib/auth")

module.exports = async function handler(req, res) {
    try {
        const auth = await requireAdmin(req, res)
        if (!auth) return

        const id = req.query.id
        if (!id) {
            return res.status(400).json({ error: "Servico invalido." })
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
    const parsed = parseServicePatch(req.body || {})
    if (!parsed.valid) {
        return res.status(400).json({ error: parsed.error })
    }

    const { data, error } = await supabase
        .from("services")
        .update(parsed.value)
        .eq("id", id)
        .select("id, name, price_cents, duration_minutes, active, created_at")
        .single()

    if (error) {
        console.error(error)
        return res.status(500).json({ error: "Erro ao atualizar o servico." })
    }

    return res.status(200).json(toDTO(data))
}

async function disable(req, res, id) {
    const { data, error } = await supabase
        .from("services")
        .update({ active: false })
        .eq("id", id)
        .select("id, name, price_cents, duration_minutes, active, created_at")
        .single()

    if (error) {
        console.error(error)
        return res.status(500).json({ error: "Erro ao desativar o servico." })
    }

    return res.status(200).json(toDTO(data))
}

function parseServicePatch(body) {
    const value = {}

    if ("name" in body) {
        const name = String(body.name || "").trim()
        if (!name) return { valid: false, error: "Informe o nome do servico." }
        value.name = name
    }

    if ("priceCents" in body) {
        const priceCents = Number(body.priceCents)
        if (!Number.isInteger(priceCents) || priceCents < 0) {
            return { valid: false, error: "Informe um preco valido." }
        }
        value.price_cents = priceCents
    }

    if ("durationMinutes" in body) {
        const durationMinutes = Number(body.durationMinutes)
        if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
            return { valid: false, error: "Informe uma duracao valida." }
        }
        value.duration_minutes = durationMinutes
    }

    if ("active" in body) {
        value.active = Boolean(body.active)
    }

    if (Object.keys(value).length === 0) {
        return { valid: false, error: "Nada para atualizar." }
    }

    return { valid: true, value }
}

function toDTO(service) {
    return {
        id: service.id,
        name: service.name,
        priceCents: service.price_cents,
        durationMinutes: service.duration_minutes,
        active: service.active,
        createdAt: service.created_at,
    }
}
