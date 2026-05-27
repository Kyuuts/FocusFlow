import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const body = await req.json()
    console.log("Received webhook body:", JSON.stringify(body))
    const { order_id, transaction_status, gross_amount, payment_type, custom_field1 } = body

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars")
    }

    if (transaction_status === 'capture' || transaction_status === 'settlement') {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      
      const user_id = custom_field1 || order_id.split('-')[1]
      console.log(`Updating user ${user_id} to premium...`)

      // Update user to premium
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ is_premium: true })
        .eq('id', user_id)

      if (profileError) {
        console.error("Error updating profile:", profileError)
        throw profileError
      }
        
      console.log(`Upserting transaction record for order ${order_id}...`)
      // Upsert transaction record
      const { error: txError } = await supabase
        .from('transactions')
        .upsert({ 
          order_id: order_id, 
          user_id: user_id,
          amount: Math.round(parseFloat(gross_amount)),
          status: transaction_status,
          payment_type: payment_type
        }, { onConflict: 'order_id' })

      if (txError) {
        console.error("Error upserting transaction:", txError)
        throw txError
      }
    }

    return new Response(JSON.stringify({ message: "OK" }), { status: 200 })
  } catch (error: any) {
    console.error("Webhook processing failed:", error)
    return new Response(JSON.stringify({ error: error.message || error }), { status: 400 })
  }
})
