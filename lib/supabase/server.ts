import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// 服务器端客户端，使用 service role key 绕过 RLS
export const supabaseServer = createClient(supabaseUrl, supabaseServiceKey)

