-- Add factory column to machines table
ALTER TABLE public.machines ADD COLUMN factory text NOT NULL DEFAULT 'Raylı Sistemler';

-- Set aviation factory machines based on the provided list
UPDATE public.machines SET factory = 'Havacılık' WHERE code IN (
  'T301', 'T107', 'T103', 'T102', 'T104', 'T105', 'T123', 'T124', 'T126',
  'T131', 'T130', 'T133', 'T132', 'T135', 'T134', 'T136', 'T140', 'T139',
  'T141', 'T120', 'T112', 'T101'
);