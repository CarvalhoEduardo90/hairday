const { createClient } = require("@supabase/supabase-js")

// Cliente Supabase para uso EXCLUSIVO no back-end (Serverless Functions).
// Usa a chave service_role, que ignora o Row Level Security — por isso
// nunca deve ser importado pelo front-end.
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: { persistSession: false },
    }
)

module.exports = { supabase }
