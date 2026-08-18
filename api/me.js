const { getAuth } = require("../lib/auth")
const { capabilitiesFor } = require("../lib/permissions")

// /api/me -> retorna o usuário autenticado, seu papel e o que ele pode fazer.
// O front usa isso para redirecionar após o login e para esconder as áreas
// às quais o papel não tem acesso (a segurança de fato está nos handlers).
module.exports = async function handler(req, res) {
    try {
        const auth = await getAuth(req)
        if (!auth) {
            return res.status(401).json({ error: "Não autenticado." })
        }

        return res.status(200).json({
            email: auth.email,
            role: auth.role,
            capabilities: capabilitiesFor(auth.role),
        })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Erro interno no servidor." })
    }
}
