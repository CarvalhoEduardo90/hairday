const { supabase } = require("../../../lib/supabase")
const { requireAdmin } = require("../../../lib/auth")
const { getAccountEmails } = require("../../../lib/accounts")
const { isValidEmail } = require("../../../lib/validation")

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

// /api/admin/clients/invite
//   POST (admin) -> envia convite Supabase Auth para cliente sem conta.
//   body: { clientId: uuid }
module.exports = async function handler(req, res) {
    try {
        if (req.method !== "POST") {
            res.setHeader("Allow", "POST")
            return res.status(405).json({ error: "Metodo nao permitido." })
        }

        const auth = await requireAdmin(req, res)
        if (!auth) return

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
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Erro interno no servidor." })
    }
}
