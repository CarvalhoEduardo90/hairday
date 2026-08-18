// Acesso a tabela user_roles — unico lugar que consulta/escreve os perfis.
// O vinculo e por e-mail, igual ao resto do sistema (clientes, agendamentos).

const { supabase } = require("./supabase")
const { normalizeRole, DEFAULT_ROLE } = require("./permissions")

// Papel de um e-mail. Quem nao esta na tabela e tratado como o papel padrao.
// Falha de leitura tambem cai no padrao: nunca promove ninguem por engano.
async function getRole(email) {
    const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("email", email)
        .maybeSingle()

    if (error) {
        console.error("[roles] falha ao ler user_roles:", error.message)
        return DEFAULT_ROLE
    }

    return normalizeRole(data?.role)
}

// Mapa e-mail -> papel, para listar varios clientes sem uma consulta por linha.
async function getRoleByEmail() {
    const { data, error } = await supabase.from("user_roles").select("email, role")

    if (error) {
        console.error("[roles] falha ao listar user_roles:", error.message)
        return new Map()
    }

    return new Map(
        data.map((row) => [(row.email || "").toLowerCase(), normalizeRole(row.role)])
    )
}

async function setRole(email, role) {
    const { error } = await supabase.from("user_roles").upsert(
        {
            email: email.toLowerCase(),
            role: normalizeRole(role),
            updated_at: new Date().toISOString(),
        },
        { onConflict: "email" }
    )

    if (error) {
        console.error("[roles] falha ao gravar user_roles:", error.message)
        return false
    }

    return true
}

module.exports = { getRole, getRoleByEmail, setRole }
