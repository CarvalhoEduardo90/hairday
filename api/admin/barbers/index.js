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
        .from("barbers")
        .select("id, name, phone, active, created_at")
        .order("name", { ascending: true })

    if (error) {
        console.error(error)
        return res.status(500).json({ error: "Erro ao buscar barbeiros." })
    }

    return res.status(200).json(data.map(toDTO))
}

async function create(req, res) {
    const parsed = parseBarber(req.body || {})
    if (!parsed.valid) {
        return res.status(400).json({ error: parsed.error })
    }

    const { data, error } = await supabase
        .from("barbers")
        .insert(parsed.value)
        .select("id, name, phone, active, created_at")
        .single()

    if (error) {
        console.error(error)
        return res.status(500).json({ error: "Erro ao salvar o barbeiro." })
    }

    return res.status(201).json(toDTO(data))
}

function parseBarber(body) {
    const name = String(body.name || "").trim()
    const phone = String(body.phone || "").trim()
    const active = body.active !== false

    if (!name) return { valid: false, error: "Informe o nome do barbeiro." }

    return {
        valid: true,
        value: {
            id: makeId(name),
            name,
            phone,
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

    return `${slug || "barbeiro"}-${Date.now().toString(36)}`
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
