const { supabase } = require("../../lib/supabase")
const { requireAdmin } = require("../../lib/auth")

// /api/admin/services         GET -> lista | POST -> cria
// /api/admin/services/:id     PATCH -> atualiza | DELETE -> desativa
//   (a rota com :id e reescrita para ?id=:id pelo vercel.json)
module.exports = async function handler(req, res) {
    try {
        const auth = await requireAdmin(req, res)
        if (!auth) return

        const id = req.query.id

        if (id) {
            if (req.method === "PATCH") return await update(req, res, id)
            if (req.method === "DELETE") return await disable(req, res, id)

            res.setHeader("Allow", "PATCH, DELETE")
            return res.status(405).json({ error: "Metodo nao permitido." })
        }

        if (req.method === "GET") return await list(req, res)
        if (req.method === "POST") return await create(req, res)

        res.setHeader("Allow", "GET, POST")
        return res.status(405).json({ error: "Metodo nao permitido." })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Erro interno no servidor." })
    }
}

async function list(req, res) {
    const { data, error } = await supabase
        .from("services")
        .select("id, name, price_cents, duration_minutes, active, created_at")
        .order("name", { ascending: true })

    if (error) {
        console.error(error)
        return res.status(500).json({ error: "Erro ao buscar servicos." })
    }

    return res.status(200).json(data.map(toDTO))
}

async function create(req, res) {
    const parsed = parseService(req.body || {})
    if (!parsed.valid) {
        return res.status(400).json({ error: parsed.error })
    }

    const { data, error } = await supabase
        .from("services")
        .insert(parsed.value)
        .select("id, name, price_cents, duration_minutes, active, created_at")
        .single()

    if (error) {
        console.error(error)
        return res.status(500).json({ error: "Erro ao salvar o servico." })
    }

    return res.status(201).json(toDTO(data))
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

function parseService(body) {
    const name = String(body.name || "").trim()
    const priceCents = Number(body.priceCents)
    const durationMinutes = Number(body.durationMinutes)
    const active = body.active !== false

    if (!name) return { valid: false, error: "Informe o nome do servico." }
    if (!Number.isInteger(priceCents) || priceCents < 0) {
        return { valid: false, error: "Informe um preco valido." }
    }
    if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
        return { valid: false, error: "Informe uma duracao valida." }
    }

    return {
        valid: true,
        value: {
            id: makeId(name),
            name,
            price_cents: priceCents,
            duration_minutes: durationMinutes,
            active,
        },
    }
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

function makeId(name) {
    const slug = name
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40)

    return `${slug || "servico"}-${Date.now().toString(36)}`
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
