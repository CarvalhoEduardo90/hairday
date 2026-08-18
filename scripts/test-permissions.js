// Teste da matriz de permissoes (node scripts/test-permissions.js).
// Sem framework: e uma tabela de expectativas comparada com lib/permissions.js.
// Serve de trava — se alguem mexer na matriz sem querer, isto quebra.

const { can, capabilitiesFor, CAPABILITIES, ROLES } = require("../lib/permissions")

// Expectativa explicita: capacidade -> papeis que devem ter acesso.
// Escrita a mao de proposito, para nao "provar" a matriz com ela mesma.
const EXPECTED = {
    "booking:read_all": ["admin", "scheduler"],
    "booking:manage_any": ["admin", "scheduler"],
    "clients:read": ["admin", "scheduler"],
    "clients:manage": ["admin"],
    "availability:block_manage": ["admin", "scheduler"],
    "availability:hours_manage": ["admin"],
    "catalog:manage": ["admin"],
    "roles:manage": ["admin"],
    "users:manage": ["admin"],
}

let failures = 0

function check(description, actual, expected) {
    if (actual === expected) return
    console.error(`FALHOU: ${description} — esperado ${expected}, obtido ${actual}`)
    failures++
}

// 1. Toda capacidade da matriz tem expectativa declarada (e vice-versa).
const inMatrix = Object.keys(CAPABILITIES).sort()
const inExpected = Object.keys(EXPECTED).sort()
check(
    "matriz e expectativa cobrem as mesmas capacidades",
    inMatrix.join(","),
    inExpected.join(",")
)

// 2. Cada combinacao capacidade x papel.
for (const [capability, allowedRoles] of Object.entries(EXPECTED)) {
    for (const role of ROLES) {
        check(
            `${role} em ${capability}`,
            can({ role }, capability),
            allowedRoles.includes(role)
        )
    }
}

// 3. Sem sessao nunca passa.
for (const capability of inMatrix) {
    check(`nao autenticado em ${capability}`, can(null, capability), false)
}

// 4. Papel desconhecido ou ausente cai no padrao (client), que nao tem nada.
for (const capability of inMatrix) {
    check(`papel invalido em ${capability}`, can({ role: "root" }, capability), false)
    check(`sem papel em ${capability}`, can({}, capability), false)
}

// 5. Capacidade inexistente e negada (e nao liberada por engano).
check("capacidade inexistente", can({ role: "admin" }, "nao:existe"), false)

// 6. capabilitiesFor bate com a matriz.
check("admin tem todas as capacidades", capabilitiesFor("admin").length, inMatrix.length)
check("client nao tem nenhuma", capabilitiesFor("client").length, 0)
check(
    "scheduler tem exatamente as suas",
    capabilitiesFor("scheduler").sort().join(","),
    inExpected
        .filter((capability) => EXPECTED[capability].includes("scheduler"))
        .sort()
        .join(",")
)

if (failures > 0) {
    console.error(`\n${failures} verificacao(oes) falharam.`)
    process.exit(1)
}

console.log(
    `OK — ${inMatrix.length} capacidades x ${ROLES.length} papeis conferidas.`
)
