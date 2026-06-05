// URL base da API, injetada em tempo de build pelo webpack (DefinePlugin).
// Em produção na Vercel o padrão é "/api" (mesma origem).
export const apiConfig = {
    baseURL: process.env.API_BASE_URL || "/api",
}
