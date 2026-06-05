// Autenticação para as Serverless Functions.
// Lê o token Bearer (JWT do Supabase) do header Authorization, valida-o e
// identifica o usuário e se ele é administrador (lista ADMIN_EMAILS).

const { supabase } = require("./supabase")

function getAdminEmails() {
    return (process.env.ADMIN_EMAILS || "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)
}

function extractToken(req) {
    const header = req.headers.authorization || req.headers.Authorization || ""
    const [scheme, token] = header.split(" ")
    if (scheme !== "Bearer" || !token) return null
    return token
}

// Retorna { user, isAdmin } se o token for válido, ou null caso contrário.
async function getAuth(req) {
    const token = extractToken(req)
    if (!token) return null

    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data?.user) return null

    const email = (data.user.email || "").toLowerCase()
    const isAdmin = getAdminEmails().includes(email)

    return { user: data.user, email, isAdmin }
}

// Helper: exige usuário autenticado. Responde 401 e retorna null se não houver.
async function requireAuth(req, res) {
    const auth = await getAuth(req)
    if (!auth) {
        res.status(401).json({ error: "Não autenticado." })
        return null
    }
    return auth
}

// Helper: exige administrador. Responde 401/403 e retorna null se não for.
async function requireAdmin(req, res) {
    const auth = await requireAuth(req, res)
    if (!auth) return null
    if (!auth.isAdmin) {
        res.status(403).json({ error: "Acesso restrito ao administrador." })
        return null
    }
    return auth
}

module.exports = { getAuth, requireAuth, requireAdmin }
