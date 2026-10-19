-- Bucket privado para as imagens dos quadros. O app serve os arquivos por /api/assets/<board>/<id>
-- (confere o acesso ao quadro antes), então não há policy de leitura pública no storage.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('board-assets', 'board-assets', false, 10485760, array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do nothing;
