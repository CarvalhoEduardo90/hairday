// Identificação de contas e categorização de clientes.
//
// Categorias (somente para exibição no painel admin):
//   - "avulso"     -> cliente sem conta de login
//   - "cadastrado" -> cliente com conta de login (mas não assinante)
//   - "assinante"  -> cliente com conta E marcado como assinante pelo admin

const { supabase } = require("./supabase")

// Percorre todas as páginas de usuários do Auth e devolve o que o painel usa.
// (Paginação simples, suficiente para o porte de uma barbearia.)
async function listAccounts() {
    const accounts = []
    const perPage = 1000
    let page = 1

    // eslint-disable-next-line no-constant-condition
    while (true) {
        const { data, error } = await supabase.auth.admin.listUsers({
            page,
            perPage,
        })
        if (error) {
            console.error("[accounts] erro ao listar usuários:", error)
            break
        }

        const users = data?.users || []
        users.forEach((user) => {
            if (!user.email) return

            accounts.push({
                id: user.id,
                email: user.email.toLowerCase(),
                name: user.user_metadata?.full_name || "",
                createdAt: user.created_at,
                lastSignInAt: user.last_sign_in_at || null,
            })
        })

        if (users.length < perPage) break
        page++
    }

    return accounts
}

// Set com os e-mails (minúsculos) de todos os usuários do Auth.
// O vínculo cliente <-> conta é feito pelo e-mail.
async function getAccountEmails() {
    return new Set((await listAccounts()).map((account) => account.email))
}

// Classifica um cliente a partir do e-mail, da flag is_subscriber e do
// conjunto de e-mails com conta.
function categorize({ email, is_subscriber }, accountEmails) {
    const hasAccount = accountEmails.has((email || "").toLowerCase())
    if (hasAccount && is_subscriber) return "assinante"
    if (hasAccount) return "cadastrado"
    return "avulso"
}

module.exports = { listAccounts, getAccountEmails, categorize }
