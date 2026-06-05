// Identificação de contas e categorização de clientes.
//
// Categorias (somente para exibição no painel admin):
//   - "avulso"     -> cliente sem conta de login
//   - "cadastrado" -> cliente com conta de login (mas não assinante)
//   - "assinante"  -> cliente com conta E marcado como assinante pelo admin

const { supabase } = require("./supabase")

// Retorna um Set com os e-mails (minúsculos) de todos os usuários do Auth.
// O vínculo cliente <-> conta é feito pelo e-mail.
async function getAccountEmails() {
    const emails = new Set()
    const perPage = 1000
    let page = 1

    // listUsers é paginado; percorre todas as páginas.
    // (Suficiente para o porte de uma barbearia.)
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
        users.forEach((u) => {
            if (u.email) emails.add(u.email.toLowerCase())
        })

        if (users.length < perPage) break
        page++
    }

    return emails
}

// Classifica um cliente a partir do e-mail, da flag is_subscriber e do
// conjunto de e-mails com conta.
function categorize({ email, is_subscriber }, accountEmails) {
    const hasAccount = accountEmails.has((email || "").toLowerCase())
    if (hasAccount && is_subscriber) return "assinante"
    if (hasAccount) return "cadastrado"
    return "avulso"
}

module.exports = { getAccountEmails, categorize }
