-- Script untuk menambal celah keamanan RLS (Row Level Security)
-- Silakan jalankan script ini di menu "SQL Editor" pada Dashboard Supabase Anda.

-- 1. Pastikan tabel profiles ada (Jika sudah ada, ini tidak akan mengubah strukturnya)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users NOT NULL PRIMARY KEY,
  email text,
  display_name text,
  xp integer DEFAULT 0,
  avatar_url text,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 2. Aktifkan RLS (Ini sangat penting!)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Hapus policy lama jika ada (untuk mereset)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;

-- 4. Buat Policy: Siapa saja boleh melihat isi profile (untuk fitur Leaderboard)
CREATE POLICY "Public profiles are viewable by everyone."
  ON public.profiles FOR SELECT
  USING ( true );

-- 5. Buat Policy: User HANYA BOLEH insert/update (upsert) data MILIKNYA SENDIRI
CREATE POLICY "Users can insert their own profile."
  ON public.profiles FOR INSERT
  WITH CHECK ( auth.uid() = id );

CREATE POLICY "Users can update own profile."
  ON public.profiles FOR UPDATE
  USING ( auth.uid() = id );

-- 6. Fungsi opsional untuk secara otomatis membuat baris profile ketika user mendaftar
-- Ini akan mencegah error "No row found" di masa depan.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Memicu fungsi di atas setiap kali ada user baru yang masuk lewat Google Auth
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
