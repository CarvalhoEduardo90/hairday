// Autenticação para as Serverless Functions.
// Lê o token Bearer (JWT do Supabase) do header Authorization, valida-o e
// resolve o papel do usuário (admin / scheduler / client).
//
// Quem pode o quê fica em lib/permissions.js — aqui só descobrimos o papel.

const { supabase } = require("./supabase")
const { can, capabilitiesFor } = require("./permissions")
const { getRole } = require("./roles")

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

// Descobre o papel de um e-mail.
// ADMIN_EMAILS vence a tabela: é o bootstrap que garante acesso ao painel
// mesmo com user_roles vazia (ou se a consulta falhar).
async function resolveRole(email) {
    if (getAdminEmails().includes(email)) return "admin"

    // Sem a tabela (migração ainda não rodada) ninguém fica preso: getRole
    // devolve o papel padrão em vez de estourar.
    return await getRole(email)
}

// Retorna { user, email, role } se o token for válido, ou null caso contrário.
async function getAuth(req) {
    const token = extractToken(req)
    if (!token) return null

    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data?.user) return null

    const email = (data.user.email || "").toLowerCase()

    return { user: data.user, email, role: await resolveRole(email) }
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

// Helper: exige uma capacidade específica (ver lib/permissions.js).
// Responde 401/403 e retorna null quando o usuário não a possui.
async function requireCapability(req, res, capability) {
    const auth = await requireAuth(req, res)
    if (!auth) return null

    if (!can(auth, capability)) {
        res.status(403).json({ error: "Você não tem acesso a esta operação." })
        return null
    }
    return auth
}

module.exports = { getAuth, requireAuth, requireCapability, capabilitiesFor }
