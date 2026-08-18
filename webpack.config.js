const path = require("path");
const fs = require("fs");
const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopywebpackPlugin = require("copy-webpack-plugin");

const envPath = path.resolve(__dirname, ".env");
if (fs.existsSync(envPath)) {
    const envLines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    envLines.forEach((line) => {
        const match = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
        if (!match) return;

        const [, key, value] = match;
        if (!process.env[key]) {
            process.env[key] = value;
        }
    });
}

// Porta em que as functions de api/ são servidas em desenvolvimento.
// O dev server (3000) encaminha /api para cá — ver devServer.proxy abaixo.
const DEV_API_PORT = Number(process.env.DEV_API_PORT) || 3001;

module.exports = {
    target: "web",
    mode: "development",


    entry: {
        main: path.resolve(__dirname, "src", "main.js"),
        login: path.resolve(__dirname, "src", "login.js"),
        criarSenha: path.resolve(__dirname, "src", "criar-senha.js"),
        admin: path.resolve(__dirname, "src", "admin.js"),
        conta: path.resolve(__dirname, "src", "conta.js"),
        clientes: path.resolve(__dirname, "src", "clientes.js"),
    },
    output: {
        filename: "[name].js",
        path: path.resolve(__dirname, "dist"),
        clean: true,
    },

    devServer: {
        static: {
            directory: path.join(__dirname, "dist"),
        },
        port: 3000,
        open: true,
        liveReload: true,
        historyApiFallback: {
            rewrites: [
                { from: /^\/criar-senha\/?$/, to: "/criar-senha.html" },
            ],
        },

        // Sem isto o historyApiFallback devolveria o index.html (com status
        // 200!) para /api/*, e o front quebraria ao tentar parsear HTML.
        proxy: {
            "/api": {
                target: `http://localhost:${DEV_API_PORT}`,
            },
        },

        // Sobe as functions de api/ junto com o dev server, num único
        // `npm run dev`. Só roda em `webpack serve`, nunca no build.
        onListening() {
            require("./scripts/dev-api").start(DEV_API_PORT)
        },
    },

    plugins: [
        // Injeta variáveis públicas no bundle.
        // API_BASE_URL padrão "/api" (mesma origem na Vercel).
        // SUPABASE_ANON_KEY é pública por design (protegida por RLS no banco).
        new webpack.DefinePlugin({
            "process.env.API_BASE_URL": JSON.stringify(
                process.env.API_BASE_URL || "/api"
            ),
            "process.env.SUPABASE_URL": JSON.stringify(
                process.env.SUPABASE_URL || ""
            ),
            "process.env.SUPABASE_ANON_KEY": JSON.stringify(
                process.env.SUPABASE_ANON_KEY || ""
            ),
        }),

        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, "index.html"),
            filename: "index.html",
            chunks: ["main"],
            favicon: path.resolve(__dirname, "src", "assets", "logo.jpg"),
        }),

        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, "login.html"),
            filename: "login.html",
            chunks: ["login"],
        }),

        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, "criar-senha.html"),
            filename: "criar-senha.html",
            chunks: ["criarSenha"],
        }),

        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, "admin.html"),
            filename: "admin.html",
            chunks: ["admin"],
        }),

        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, "minha-conta.html"),
            filename: "minha-conta.html",
            chunks: ["conta"],
        }),

        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, "clientes.html"),
            filename: "clientes.html",
            chunks: ["clientes"],
        }),

        new CopywebpackPlugin({
            patterns: [
                {
                    from: path.resolve(__dirname, "src", "assets"),
                    to: path.resolve(__dirname, "dist", "src", "assets"),
                }
            ]
        })

    ],

    module: {
        rules: [
            {
                test: /\.css$/,
                use: ["style-loader", "css-loader"],
            },
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: "babel-loader",
                    options: {
                        presets: ["@babel/preset-env"]
                    }
                }
            }
        ]
    }
}



