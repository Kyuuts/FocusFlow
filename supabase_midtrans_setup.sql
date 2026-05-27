-- Script untuk setup database persiapan integrasi Midtrans
-- Silakan jalankan script ini di menu "SQL Editor" pada Dashboard Supabase Anda.

-- 1. Tambah kolom is_premium ke tabel profiles (jika belum ada)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_premium boolean DEFAULT false;

-- 2. Buat tabel transactions untuk mencatat riwayat pembayaran
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id text UNIQUE NOT NULL,
  user_id uuid REFERENCES auth.users NOT NULL,
  amount integer NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending, settlement, cancel, expire, deny
  payment_type text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 3. Aktifkan RLS (Row Level Security) untuk tabel transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- 4. Policy: User hanya boleh melihat riwayat transaksinya sendiri
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.transactions;
CREATE POLICY "Users can view their own transactions"
  ON public.transactions FOR SELECT
  USING ( auth.uid() = user_id );

-- Catatan Penting:
-- Kita tidak membuat policy INSERT atau UPDATE untuk tabel transactions di sini.
-- Penambahan dan perubahan status transaksi nantinya HANYA akan dilakukan secara aman 
-- dari dalam Supabase Edge Functions (backend), bukan dari client-side.

-- 5. Keamanan Ekstra: Cegah client-side memodifikasi kolom is_premium secara ilegal
CREATE OR REPLACE FUNCTION public.protect_premium_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_premium IS DISTINCT FROM OLD.is_premium AND auth.role() = 'authenticated' THEN
    RAISE EXCEPTION 'Anda tidak memiliki akses untuk mengubah status premium secara langsung.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_premium_status ON public.profiles;
CREATE TRIGGER trg_protect_premium_status
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.protect_premium_status();
