const { supabase } = require("../../lib/supabase")
const { requireCapability } = require("../../lib/auth")

// /api/admin/barbers         GET -> lista | POST -> cria
// /api/admin/barbers/:id     PATCH -> atualiza | DELETE -> desativa
//   (a rota com :id e reescrita para ?id=:id pelo vercel.json)
module.exports = async function handler(req, res) {
    try {
        const auth = await requireCapability(req, res, "catalog:manage")
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

function makeId(name) {
    const slug = name
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
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
