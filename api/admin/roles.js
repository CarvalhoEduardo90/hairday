const { requireCapability } = require("../../lib/auth")
const { isValidRole, ROLES } = require("../../lib/permissions")
const { setRole } = require("../../lib/roles")
const { isValidEmail } = require("../../lib/validation")

// /api/admin/roles   PATCH -> define o perfil de um e-mail { email, role }
module.exports = async function handler(req, res) {
    try {
        if (req.method !== "PATCH") {
            res.setHeader("Allow", "PATCH")
            return res.status(405).json({ error: "Método não permitido." })
        }

        const auth = await requireCapability(req, res, "roles:manage")
        if (!auth) return

        const { email, role } = req.body || {}

        if (!email || !isValidEmail(email)) {
            return res.status(400).json({ error: "Informe um e-mail válido." })
        }

        if (!isValidRole(role)) {
            return res
                .status(400)
                .json({ error: `Perfil inválido. Use um destes: ${ROLES.join(", ")}.` })
        }

        // Evita que o admin se rebaixe e perca o acesso ao painel.
        if (email.toLowerCase() === auth.email && role !== "admin") {
            return res
                .status(400)
                .json({ error: "Você não pode alterar o seu próprio perfil." })
        }

        if (!(await setRole(email, role))) {
            return res.status(500).json({ error: "Erro ao salvar o perfil." })
        }

        return res.status(200).json({ email: email.toLowerCase(), role })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Erro interno no servidor." })
    }
}
