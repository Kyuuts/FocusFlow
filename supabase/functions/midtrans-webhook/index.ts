import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const body = await req.json()
    const { order_id, transaction_status, gross_amount, payment_type, custom_field1 } = body

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (transaction_status === 'capture' || transaction_status === 'settlement') {
      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
      
      const user_id = custom_field1 || order_id.split('-')[1]

      // Update user to premium
      await supabase
        .from('profiles')
        .update({ is_premium: true })
        .eq('id', user_id)
        
      // Upsert transaction record
      await supabase
        .from('transactions')
        .upsert({ 
          order_id: order_id, 
          user_id: user_id,
          amount: parseInt(gross_amount),
          status: transaction_status,
          payment_type: payment_type
        }, { onConflict: 'order_id' })
    }

    return new Response(JSON.stringify({ message: "OK" }), { status: 200 })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 })
  }
})
