const { getAuth } = require("../lib/auth")

// /api/me -> retorna os dados do usuário autenticado e se ele é admin.
// Usado pelo front para decidir o redirecionamento após o login.
module.exports = async function handler(req, res) {
    try {
        const auth = await getAuth(req)
        if (!auth) {
            return res.status(401).json({ error: "Não autenticado." })
        }

        return res.status(200).json({
            email: auth.email,
            isAdmin: auth.isAdmin,
        })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Erro interno no servidor." })
    }
}
