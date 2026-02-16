
-- Modül izinleri tablosu: her kullanıcıya hangi modüllere erişim verildiğini tutar
CREATE TABLE public.user_module_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  granted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, module_key)
);

ALTER TABLE public.user_module_permissions ENABLE ROW LEVEL SECURITY;

-- Kullanıcılar kendi izinlerini görebilir
CREATE POLICY "Users can view their own permissions"
  ON public.user_module_permissions FOR SELECT
  USING (auth.uid() = user_id);

-- Adminler tüm izinleri görebilir
CREATE POLICY "Admins can view all permissions"
  ON public.user_module_permissions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Adminler izin ekleyebilir
CREATE POLICY "Admins can insert permissions"
  ON public.user_module_permissions FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Adminler izin güncelleyebilir
CREATE POLICY "Admins can update permissions"
  ON public.user_module_permissions FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Adminler izin silebilir
CREATE POLICY "Admins can delete permissions"
  ON public.user_module_permissions FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Adminler tüm profilleri görebilsin
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Adminler tüm rolleri görebilsin
CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Adminler rol ekleyebilsin
CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Adminler rol güncelleyebilsin
CREATE POLICY "Admins can update roles"
  ON public.user_roles FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Adminler rol silebilsin
CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Adminler profil güncelleyebilsin
CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- handle_new_user trigger'ını oluştur (henüz yoksa)
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger
CREATE TRIGGER update_user_module_permissions_updated_at
  BEFORE UPDATE ON public.user_module_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
