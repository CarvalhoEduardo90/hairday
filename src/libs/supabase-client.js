import { createClient } from "@supabase/supabase-js"

// Cliente Supabase do front-end (chave anon, pública por design).
// Usado apenas para autenticação (login/sessão). O acesso aos dados é
// feito pelas Serverless Functions, que validam o token.
const supabaseUrl = process.env.SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Retorna o token de acesso da sessão atual (ou null se não logado).
export async function getAccessToken() {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
}
