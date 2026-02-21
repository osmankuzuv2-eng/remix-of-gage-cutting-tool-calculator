
-- Create coatings table
CREATE TABLE public.coatings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.coatings ENABLE ROW LEVEL SECURITY;

-- Anyone can view coatings
CREATE POLICY "Anyone can view coatings"
ON public.coatings FOR SELECT
USING (true);

-- Admins can insert coatings
CREATE POLICY "Admins can insert coatings"
ON public.coatings FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update coatings
CREATE POLICY "Admins can update coatings"
ON public.coatings FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete coatings
CREATE POLICY "Admins can delete coatings"
ON public.coatings FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_coatings_updated_at
BEFORE UPDATE ON public.coatings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default coatings
INSERT INTO public.coatings (name, description, price, sort_order) VALUES
('Sert Krom Kaplama', 'Yüksek sertlik ve aşınma direnci sağlar', 15.00, 1),
('Nikel Kaplama', 'Korozyon direnci ve estetik görünüm', 12.00, 2),
('Çinko Kaplama', 'Korozyon koruması, ekonomik çözüm', 8.00, 3),
('TiN (Titanyum Nitrür)', 'Altın renkli, yüksek sertlik', 25.00, 4),
('TiAlN (Titanyum Alüminyum Nitrür)', 'Yüksek sıcaklık direnci', 30.00, 5),
('DLC (Diamond-Like Carbon)', 'Düşük sürtünme katsayısı', 45.00, 6),
('Fosfat Kaplama', 'Yağ tutma ve korozyon önleme', 5.00, 7),
('Anodizasyon', 'Alüminyum yüzey sertleştirme', 10.00, 8);
