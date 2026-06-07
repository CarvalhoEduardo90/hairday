const { supabase } = require("../../lib/supabase")
const { requireAdmin } = require("../../lib/auth")
const { getAccountEmails, categorize } = require("../../lib/accounts")
const { isValidEmail } = require("../../lib/validation")

// /api/admin/clients              GET   -> lista clientes com categoria
// /api/admin/clients/:id          PATCH -> marca/desmarca assinante { isSubscriber }
// /api/admin/clients/invite       POST  -> envia convite Supabase Auth { clientId }
//   (as rotas com sufixo sao reescritas para ?id=:id pelo vercel.json;
//    "invite" e tratado como caso especial — ids de cliente sao UUIDs.)
module.exports = async function handler(req, res) {
    try {
        const auth = await requireAdmin(req, res)
        if (!auth) return

        const id = req.query.id

        if (id === "invite") {
            if (req.method === "POST") return await invite(req, res)

            res.setHeader("Allow", "POST")
            return res.status(405).json({ error: "Metodo nao permitido." })
        }

        if (id) {
            if (req.method === "PATCH") return await updateSubscriber(req, res, id)

            res.setHeader("Allow", "PATCH")
            return res.status(405).json({ error: "Método não permitido." })
        }

        if (req.method === "GET") return await list(req, res)

        res.setHeader("Allow", "GET")
        return res.status(405).json({ error: "Método não permitido." })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Erro interno no servidor." })
    }
}

async function list(req, res) {
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
}

async function updateSubscriber(req, res, id) {
    const { isSubscriber } = req.body || {}

    if (typeof isSubscriber !== "boolean") {
        return res
            .status(400)
            .json({ error: "Campo 'isSubscriber' deve ser true ou false." })
    }

    const { data, error } = await supabase
        .from("clients")
        .update({ is_subscriber: isSubscriber })
        .eq("id", id)
        .select("id, is_subscriber")

    if (error) {
        console.error(error)
        return res.status(500).json({ error: "Erro ao atualizar o cliente." })
    }

    if (!data || data.length === 0) {
        return res.status(404).json({ error: "Cliente não encontrado." })
    }

    return res.status(200).json({
        id: data[0].id,
        isSubscriber: data[0].is_subscriber,
    })
}

async function invite(req, res) {
    const { clientId } = req.body || {}
    if (!clientId) {
        return res.status(400).json({ error: "Cliente obrigatorio." })
    }

    const { data: client, error: clientError } = await supabase
        .from("clients")
        .select("id, full_name, email, phone")
        .eq("id", clientId)
        .single()

    if (clientError || !client) {
        console.error(clientError)
        return res.status(404).json({ error: "Cliente nao encontrado." })
    }

    const email = (client.email || "").trim().toLowerCase()
    if (!isValidEmail(email)) {
        return res.status(400).json({ error: "Cliente sem e-mail valido." })
    }

    const accountEmails = await getAccountEmails()
    if (accountEmails.has(email)) {
        return res
            .status(409)
            .json({ error: "Este cliente ja possui uma conta de acesso." })
    }

    const baseUrl = getBaseUrl(req)
    if (!baseUrl) {
        return res.status(500).json({
            error: "Nao foi possivel montar a URL de aceite do convite.",
        })
    }

    const redirectTo = new URL("/criar-senha", baseUrl).toString()

    const { error } = await supabase.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: {
            full_name: client.full_name,
            phone: client.phone,
        },
    })

    if (error) {
        console.error("[invite] erro ao enviar convite:", error)
        return res.status(400).json({
            error: error.message || "Nao foi possivel enviar o convite.",
        })
    }

    return res.status(200).json({
        ok: true,
        email,
        redirectTo,
    })
}

function getBaseUrl(req) {
    const configuredUrl =
        process.env.PUBLIC_SITE_URL ||
        process.env.SITE_URL ||
        process.env.VERCEL_PROJECT_PRODUCTION_URL

    if (configuredUrl) {
        return configuredUrl.startsWith("http")
            ? configuredUrl
            : `https://${configuredUrl}`
    }

    const host = req.headers["x-forwarded-host"] || req.headers.host
    const proto = req.headers["x-forwarded-proto"] || "https"

    if (!host) return null

    return `${proto}://${host}`
}
