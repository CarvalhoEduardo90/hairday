// Script de captura de telas para avaliação de design.
// Serve a pasta dist e fotografa cada página em desktop e mobile.
// Páginas protegidas recebem sessão e dados simulados (apenas para o screenshot).

const http = require("http")
const fs = require("fs")
const path = require("path")
const { chromium } = require("playwright")

const DIST = path.resolve(__dirname, "..", "dist")
const OUT = path.resolve(__dirname, "..", "shots")
const PORT = 4599

const MIME = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".json": "application/json",
}

function serve() {
    return http
        .createServer((req, res) => {
            let urlPath = decodeURIComponent(req.url.split("?")[0])
            if (urlPath === "/") urlPath = "/index.html"
            const filePath = path.join(DIST, urlPath)
            fs.readFile(filePath, (err, data) => {
                if (err) {
                    res.writeHead(404)
                    return res.end("not found")
                }
                res.writeHead(200, {
                    "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream",
                })
                res.end(data)
            })
        })
        .listen(PORT)
}

// Sessão Supabase falsa (chave sb-demo-auth-token p/ projeto demo.supabase.co).
const fakeSession = {
    access_token: "fake-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: 9999999999,
    refresh_token: "fake-refresh",
    user: {
        id: "00000000-0000-0000-0000-000000000000",
        aud: "authenticated",
        role: "authenticated",
        email: "dono@barbearia.com",
    },
}

const today = new Date()
function iso(h) {
    const d = new Date(today)
    d.setHours(h, 0, 0, 0)
    return d.toISOString()
}

const adminData = [
    { id: "1", when: iso(9), name: "Rodrigo Gonçalves", email: "a@a.com", phone: "11999990001" },
    { id: "2", when: iso(10), name: "Marina Alves", email: "b@b.com", phone: "11999990002" },
    { id: "3", when: iso(14), name: "Carlos Henrique", email: "c@c.com", phone: "11999990003" },
    { id: "4", when: iso(20), name: "Felipe Costa", email: "d@d.com", phone: "11999990004" },
]
const clientData = [
    { id: "1", when: iso(10) },
    { id: "2", when: iso(16) },
]

const viewports = {
    desktop: { width: 1366, height: 900 },
    mobile: { width: 390, height: 844 },
}

const pages = [
    { name: "index", url: "/index.html", protected: false },
    { name: "login", url: "/login.html", protected: false },
    { name: "admin", url: "/admin.html", protected: true, data: adminData },
    { name: "conta", url: "/minha-conta.html", protected: true, data: clientData },
]

async function run() {
    if (!fs.existsSync(OUT)) fs.mkdirSync(OUT)
    const server = serve()
    const browser = await chromium.launch()

    for (const [vpName, vp] of Object.entries(viewports)) {
        for (const p of pages) {
            const context = await browser.newContext({ viewport: vp, deviceScaleFactor: 2 })

            // Mocks de rede para páginas protegidas.
            await context.route("**/api/**", (route) => {
                const u = route.request().url()
                if (u.includes("/api/me")) {
                    return route.fulfill({ json: { email: "dono@barbearia.com", isAdmin: true } })
                }
                if (u.includes("/api/admin/appointments")) {
                    return route.fulfill({ json: adminData })
                }
                if (u.includes("/api/my-appointments")) {
                    return route.fulfill({ json: clientData })
                }
                if (u.includes("/api/appointments")) {
                    return route.fulfill({ json: [] })
                }
                return route.fulfill({ json: {} })
            })

            const page = await context.newPage()
            page.on("dialog", (d) => d.dismiss().catch(() => {}))

            if (p.protected) {
                await page.addInitScript((session) => {
                    localStorage.setItem(
                        "sb-demo-auth-token",
                        JSON.stringify(session)
                    )
                }, fakeSession)
            }

            await page.goto(`http://localhost:${PORT}${p.url}`, {
                waitUntil: "networkidle",
            })
            await page.waitForTimeout(800)

            const file = path.join(OUT, `${p.name}-${vpName}.png`)
            await page.screenshot({ path: file, fullPage: true })
            console.log("ok:", file)
            await context.close()
        }
    }

    await browser.close()
    server.close()
}

run().catch((e) => {
    console.error(e)
    process.exit(1)
})
