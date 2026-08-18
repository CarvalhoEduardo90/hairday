// Servidor de API para desenvolvimento local.
//
// Reproduz o essencial do runtime de Serverless Functions da Vercel: roteia
// /api/* para os arquivos de `api/`, aplica os rewrites declarados no
// vercel.json e injeta os helpers que os handlers esperam (req.query,
// req.body, res.status().json()).
//
// Não vai para produção — lá a própria Vercel executa os mesmos handlers.
// O webpack-dev-server sobe este servidor automaticamente (webpack.config.js)
// e encaminha /api para cá. Também roda sozinho: `node scripts/dev-api.js`.

const http = require("http")
const fs = require("fs")
const path = require("path")

const ROOT = path.resolve(__dirname, "..")
const API_DIR = path.join(ROOT, "api")
const LIB_DIR = path.join(ROOT, "lib")

// Carrega o .env no process.env (mesmo parser usado pelo webpack.config.js).
// As functions leem SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAILS, RESEND_API_KEY etc.
function loadEnv() {
    const envPath = path.join(ROOT, ".env")
    if (!fs.existsSync(envPath)) return

    fs.readFileSync(envPath, "utf8")
        .split(/\r?\n/)
        .forEach((line) => {
            const match = line.match(/^([A-Za-z0-9_]+)=(.*)$/)
            if (!match) return

            const [, key, value] = match
            if (!process.env[key]) {
                process.env[key] = value
            }
        })
}

// Converte os rewrites do vercel.json em regex.
// Ex: "/api/appointments/:id" -> /^\/api\/appointments\/([^/]+)$/ com param "id".
function loadRewrites() {
    const configPath = path.join(ROOT, "vercel.json")
    if (!fs.existsSync(configPath)) return []

    const config = JSON.parse(fs.readFileSync(configPath, "utf8"))

    return (config.rewrites || [])
        .filter((rule) => rule.source.startsWith("/api/"))
        .map((rule) => {
            const params = (rule.source.match(/:[A-Za-z0-9_]+/g) || []).map(
                (param) => param.slice(1)
            )
            const pattern = rule.source
                .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
                .replace(/:[A-Za-z0-9_]+/g, "([^/]+)")

            return {
                regex: new RegExp(`^${pattern}$`),
                params,
                destination: rule.destination,
            }
        })
}

// Aplica o primeiro rewrite que casar. Devolve o caminho (com query) final.
function applyRewrites(pathname, rewrites) {
    for (const rule of rewrites) {
        const match = pathname.match(rule.regex)
        if (!match) continue

        return rule.params.reduce(
            (destination, param, index) =>
                destination.split(`:${param}`).join(match[index + 1]),
            rule.destination
        )
    }
    return pathname
}

// Mapeia "/api/admin/services" -> <raiz>/api/admin/services.js
// Retorna null se não existir (ou se tentarem escapar da pasta api/).
function resolveHandlerFile(pathname) {
    const relative = pathname.replace(/^\/+/, "")
    if (!relative.startsWith("api/")) return null

    const file = path.resolve(ROOT, `${relative}.js`)
    if (!file.startsWith(API_DIR + path.sep)) return null

    return fs.existsSync(file) ? file : null
}

// Descarta o cache de require de api/ e lib/ para que alterações nesses
// arquivos valham na próxima requisição, sem reiniciar o servidor.
function clearHandlerCache() {
    Object.keys(require.cache).forEach((id) => {
        if (id.startsWith(API_DIR + path.sep) || id.startsWith(LIB_DIR + path.sep)) {
            delete require.cache[id]
        }
    })
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = []
        req.on("data", (chunk) => chunks.push(chunk))
        req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
        req.on("error", reject)
    })
}

// Na Vercel, req.body já vem parseado quando o content-type é JSON.
// Os handlers usam sempre `req.body || {}`, então deixar undefined é seguro.
function parseBody(raw, contentType) {
    if (!raw) return undefined
    if (!String(contentType || "").includes("application/json")) return raw

    try {
        return JSON.parse(raw)
    } catch {
        return undefined
    }
}

// res.status(código).json(objeto) — o único terminador usado pelos handlers.
function enhanceResponse(res) {
    res.status = (code) => {
        res.statusCode = code
        return res
    }
    res.json = (payload) => {
        res.setHeader("Content-Type", "application/json; charset=utf-8")
        res.end(payload === undefined ? undefined : JSON.stringify(payload))
        return res
    }
    return res
}

function createServer() {
    loadEnv()

    return http.createServer(async (req, res) => {
        const url = new URL(req.url, "http://localhost")
        // Relidos a cada requisição: assim uma rota nova no vercel.json passa
        // a valer sem reiniciar, igual às alterações em api/ e lib/.
        const rewritten = new URL(
            applyRewrites(url.pathname, loadRewrites()),
            "http://localhost"
        )

        // Query da URL original tem precedência sobre a injetada pelo rewrite.
        const query = Object.fromEntries(rewritten.searchParams)
        url.searchParams.forEach((value, key) => {
            query[key] = value
        })

        enhanceResponse(res)

        const handlerFile = resolveHandlerFile(rewritten.pathname)
        if (!handlerFile) {
            console.log(`${req.method} ${url.pathname} -> 404 (sem handler)`)
            // Responde JSON, nunca HTML: um 404 em HTML causaria o erro
            // "Unexpected token '<'" no front.
            res.status(404).json({ error: `Rota não encontrada: ${url.pathname}` })
            return
        }

        req.query = query
        req.body = parseBody(await readBody(req), req.headers["content-type"])

        try {
            clearHandlerCache()
            const handler = require(handlerFile)
            await handler(req, res)
        } catch (error) {
            console.error(`${req.method} ${url.pathname} ->`, error)
            if (!res.headersSent) {
                res.status(500).json({ error: "Erro interno no servidor (dev)." })
            }
        }

        console.log(`${req.method} ${url.pathname} -> ${res.statusCode}`)
    })
}

function start(port = Number(process.env.DEV_API_PORT) || 3001) {
    const server = createServer()

    server.listen(port, () => {
        console.log(`[dev-api] functions de api/ servidas em http://localhost:${port}`)
    })

    server.on("error", (error) => {
        if (error.code === "EADDRINUSE") {
            console.error(
                `[dev-api] porta ${port} já está em uso. Encerre o outro processo ou defina DEV_API_PORT.`
            )
            return
        }
        console.error("[dev-api]", error)
    })

    return server
}

module.exports = { createServer, start }

if (require.main === module) {
    start()
}
