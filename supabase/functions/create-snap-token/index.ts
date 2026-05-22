import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user_id, email, name, amount } = await req.json()
    const MIDTRANS_SERVER_KEY = Deno.env.get('MIDTRANS_SERVER_KEY')

    if (!MIDTRANS_SERVER_KEY) throw new Error("MIDTRANS_SERVER_KEY is not set")

    const order_id = `ORDER-${user_id}-${Date.now()}`
    const authString = btoa(`${MIDTRANS_SERVER_KEY}:`)
    
    // Create transaction in Midtrans (Auto detect Prod/Sandbox)
    const isProd = MIDTRANS_SERVER_KEY.startsWith('Mid-server-')
    const apiUrl = isProd ? 'https://app.midtrans.com/snap/v1/transactions' : 'https://app.sandbox.midtrans.com/snap/v1/transactions'

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authString}`
      },
      body: JSON.stringify({
        transaction_details: {
          order_id: order_id,
          gross_amount: amount
        },
        customer_details: {
          first_name: name,
          email: email
        }
      })
    })

    const data = await response.json()

    if (!response.ok || !data.token) {
      const errorMsg = data.error_messages ? data.error_messages.join(', ') : (data.message || JSON.stringify(data) || 'Gagal membuat token pembayaran dari Midtrans');
      throw new Error(`Midtrans Error: ${errorMsg}`);
    }

    return new Response(JSON.stringify({ token: data.token, order_id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
