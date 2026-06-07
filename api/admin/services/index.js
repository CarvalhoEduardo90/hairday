const { supabase } = require("../../../lib/supabase")
const { requireAdmin } = require("../../../lib/auth")

module.exports = async function handler(req, res) {
    try {
        const auth = await requireAdmin(req, res)
        if (!auth) return

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

function makeId(name) {
    const slug = name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
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
