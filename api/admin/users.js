const { supabase } = require("../../lib/supabase")
const { requireCapability } = require("../../lib/auth")
const { listAccounts } = require("../../lib/accounts")
const { getRoleByEmail, setRole } = require("../../lib/roles")
const { isValidEmail } = require("../../lib/validation")

// Contas da equipe (quem acessa o painel). Clientes ficam em /api/admin/clients.
//
// /api/admin/users        GET  -> lista a equipe | POST -> cria conta
// /api/admin/users/:id    PATCH -> edita nome/perfil/senha | DELETE -> exclui
//   (a rota com :id e reescrita para ?id=:id pelo vercel.json)

const MIN_PASSWORD_LENGTH = 6

// Perfis que dao acesso ao painel — os que aparecem nesta tela.
const TEAM_ROLES = ["admin", "scheduler"]

module.exports = async function handler(req, res) {
    try {
        const id = req.query.id

        const allowed = id ? ["PATCH", "DELETE"] : ["GET", "POST"]
        if (!allowed.includes(req.method)) {
            res.setHeader("Allow", allowed.join(", "))
            return res.status(405).json({ error: "Método não permitido." })
        }

        const auth = await requireCapability(req, res, "users:manage")
        if (!auth) return

        if (id) {
            if (req.method === "PATCH") return await update(req, res, id, auth)
            return await remove(req, res, id, auth)
        }

        if (req.method === "GET") return await list(req, res)
        return await create(req, res)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Erro interno no servidor." })
    }
}

// Junta as contas do Auth com os perfis e devolve so a equipe.
async function loadTeam() {
    const [accounts, roleByEmail] = await Promise.all([
        listAccounts(),
        getRoleByEmail(),
    ])

    // ADMIN_EMAILS tem precedencia sobre a tabela (bootstrap), entao precisa
    // ser considerado aqui tambem, ou o dono nao apareceria na propria lista.
    const bootstrapAdmins = (process.env.ADMIN_EMAILS || "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)

    return accounts
        .map((account) => ({
            ...account,
            role: bootstrapAdmins.includes(account.email)
                ? "admin"
                : roleByEmail.get(account.email) || "client",
            // Conta vinda do ADMIN_EMAILS nao pode ser rebaixada nem excluida
            // pelo painel: o papel dela nao vem do banco.
            locked: bootstrapAdmins.includes(account.email),
        }))
        .filter((account) => TEAM_ROLES.includes(account.role))
}

async function list(req, res) {
    const team = await loadTeam()

    team.sort((a, b) => a.name.localeCompare(b.name) || a.email.localeCompare(b.email))

    return res.status(200).json(team)
}

function validateRole(role) {
    return TEAM_ROLES.includes(role)
}

function validatePassword(password) {
    return typeof password === "string" && password.length >= MIN_PASSWORD_LENGTH
}

async function create(req, res) {
    const { name, email, password, role } = req.body || {}

    const cleanName = (name || "").trim()
    const cleanEmail = (email || "").trim().toLowerCase()

    if (!cleanName) {
        return res.status(400).json({ error: "Informe o nome." })
    }
    if (!isValidEmail(cleanEmail)) {
        return res.status(400).json({ error: "Informe um e-mail válido." })
    }
    if (!validatePassword(password)) {
        return res.status(400).json({
            error: `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
        })
    }
    if (!validateRole(role)) {
        return res.status(400).json({ error: "Perfil inválido." })
    }

    const { data, error } = await supabase.auth.admin.createUser({
        email: cleanEmail,
        password,
        // Sem confirmacao por e-mail: a conta ja nasce pronta para uso.
        email_confirm: true,
        user_metadata: { full_name: cleanName },
    })

    if (error) {
        console.error(error)
        // O Supabase responde 422 quando o e-mail ja existe.
        const alreadyExists = /already|registered|exists/i.test(error.message || "")
        return res.status(alreadyExists ? 409 : 500).json({
            error: alreadyExists
                ? "Já existe uma conta com este e-mail."
                : "Não foi possível criar a conta.",
        })
    }

    if (!(await setRole(cleanEmail, role))) {
        // A conta existe mas ficaria sem perfil (= cliente). Desfaz para nao
        // deixar um estado pela metade.
        await supabase.auth.admin.deleteUser(data.user.id)
        return res.status(500).json({ error: "Não foi possível definir o perfil." })
    }

    return res.status(201).json({
        id: data.user.id,
        email: cleanEmail,
        name: cleanName,
        role,
    })
}

// Localiza uma conta pelo id e garante que ela e da equipe.
async function findTeamMember(id) {
    return (await loadTeam()).find((account) => account.id === id) || null
}

async function update(req, res, id, auth) {
    const target = await findTeamMember(id)
    if (!target) {
        return res.status(404).json({ error: "Conta não encontrada." })
    }

    const { name, role, password } = req.body || {}
    const isSelf = target.email === auth.email

    // Alterar nome e/ou senha no Auth.
    const changes = {}

    if (name !== undefined) {
        const cleanName = (name || "").trim()
        if (!cleanName) {
            return res.status(400).json({ error: "Informe o nome." })
        }
        changes.user_metadata = { full_name: cleanName }
    }

    if (password !== undefined) {
        if (!validatePassword(password)) {
            return res.status(400).json({
                error: `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
            })
        }
        changes.password = password
    }

    if (Object.keys(changes).length > 0) {
        const { error } = await supabase.auth.admin.updateUserById(id, changes)
        if (error) {
            console.error(error)
            return res.status(500).json({ error: "Não foi possível salvar a conta." })
        }
    }

    // Alterar o perfil.
    if (role !== undefined && role !== target.role) {
        if (!validateRole(role)) {
            return res.status(400).json({ error: "Perfil inválido." })
        }
        if (isSelf) {
            return res
                .status(400)
                .json({ error: "Você não pode alterar o seu próprio perfil." })
        }
        if (target.locked) {
            return res.status(400).json({
                error: "Esta conta é administradora por variável de ambiente (ADMIN_EMAILS) e não pode ser alterada aqui.",
            })
        }
        if (await wouldRemoveLastAdmin(target, role)) {
            return res
                .status(400)
                .json({ error: "É preciso manter ao menos um administrador." })
        }
        if (!(await setRole(target.email, role))) {
            return res.status(500).json({ error: "Não foi possível salvar o perfil." })
        }
    }

    return res.status(200).json({ id, updated: true })
}

async function remove(req, res, id, auth) {
    const target = await findTeamMember(id)
    if (!target) {
        return res.status(404).json({ error: "Conta não encontrada." })
    }

    if (target.email === auth.email) {
        return res
            .status(400)
            .json({ error: "Você não pode excluir a sua própria conta." })
    }
    if (target.locked) {
        return res.status(400).json({
            error: "Esta conta é administradora por variável de ambiente (ADMIN_EMAILS) e não pode ser excluída aqui.",
        })
    }
    if (await wouldRemoveLastAdmin(target, "client")) {
        return res
            .status(400)
            .json({ error: "É preciso manter ao menos um administrador." })
    }

    const { error } = await supabase.auth.admin.deleteUser(id)
    if (error) {
        console.error(error)
        return res.status(500).json({ error: "Não foi possível excluir a conta." })
    }

    // Remove o perfil. O registro em `clients` e o historico de agendamentos
    // continuam: eles sao do cliente, nao da conta de login.
    const { error: roleError } = await supabase
        .from("user_roles")
        .delete()
        .eq("email", target.email)

    if (roleError) {
        console.error("[users] conta excluída, mas o perfil ficou:", roleError.message)
    }

    return res.status(200).json({ id, deleted: true })
}

// Impede que o ultimo admin seja rebaixado ou excluido, o que trancaria
// todo mundo para fora da administracao.
async function wouldRemoveLastAdmin(target, nextRole) {
    if (target.role !== "admin" || nextRole === "admin") return false

    const admins = (await loadTeam()).filter((account) => account.role === "admin")

    return admins.length <= 1
}
