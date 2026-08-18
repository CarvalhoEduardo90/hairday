// Matriz de permissoes do sistema — fonte unica de verdade.
//
// Para mudar quem pode o que, edite APENAS a tabela CAPABILITIES abaixo.
// Os handlers nunca comparam papel diretamente (nada de `role === "admin"`);
// eles perguntam por capacidade, via requireCapability/can.
//
// Perfis:
//   admin     — acesso a tudo
//   scheduler — "agendamento": a agenda inteira e leitura de clientes
//   client    — padrao de quem tem conta: so os proprios agendamentos

const ROLES = ["admin", "scheduler", "client"]
const DEFAULT_ROLE = "client"

const CAPABILITIES = {
    // Agenda
    "booking:read_all": ["admin", "scheduler"],
    "booking:manage_any": ["admin", "scheduler"],

    // Clientes
    "clients:read": ["admin", "scheduler"],
    "clients:manage": ["admin"],

    // Disponibilidade
    "availability:block_manage": ["admin", "scheduler"],
    "availability:hours_manage": ["admin"],

    // Catalogo e administracao
    "catalog:manage": ["admin"],
    "roles:manage": ["admin"],
    "users:manage": ["admin"],
}

// Fora desta matriz (e portanto sem capacidade associada):
// - agendar e consultar horarios livres sao publicos, sem login;
// - ver/cancelar os PROPRIOS agendamentos vale para qualquer autenticado,
//   e e verificado comparando o e-mail do dono, nao por papel.

function isValidRole(role) {
    return ROLES.includes(role)
}

function normalizeRole(role) {
    return isValidRole(role) ? role : DEFAULT_ROLE
}

// auth e o objeto devolvido por getAuth ({ role, ... }) ou null.
function can(auth, capability) {
    const allowed = CAPABILITIES[capability]
    if (!allowed) {
        // Capacidade inexistente: nega e avisa, em vez de liberar por engano.
        console.error(`[permissions] capacidade desconhecida: ${capability}`)
        return false
    }
    if (!auth) return false

    return allowed.includes(normalizeRole(auth.role))
}

// Lista as capacidades de um papel — o front usa isso para esconder abas.
function capabilitiesFor(role) {
    const normalized = normalizeRole(role)

    return Object.keys(CAPABILITIES).filter((capability) =>
        CAPABILITIES[capability].includes(normalized)
    )
}

module.exports = {
    ROLES,
    DEFAULT_ROLE,
    CAPABILITIES,
    can,
    capabilitiesFor,
    isValidRole,
    normalizeRole,
}
