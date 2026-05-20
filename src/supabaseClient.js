import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://galrqqjovnykekpfglho.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhbHJxcWpvdm55a2VrcGZnbGhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNTgzNjEsImV4cCI6MjA5NDgzNDM2MX0.rihQfdtwN6SuU491WtCKEvYySgzhYRbQTkoDNpDVKaU'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
