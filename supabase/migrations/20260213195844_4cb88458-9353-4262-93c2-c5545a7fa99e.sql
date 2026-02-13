-- Make the technical-drawings bucket private
UPDATE storage.buckets SET public = false WHERE id = 'technical-drawings';