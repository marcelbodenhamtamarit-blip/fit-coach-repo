-- lib/quick-add-token.server.ts busca por token_hash y escribe last_used_at,
-- pero quick_add_tokens.sql no crea esas columnas. Esta migración las añade
-- para que una base de datos nueva coincida con el código. Es idempotente.
-- Requiere pgcrypto (ya usado por gen_random_bytes en quick_add_tokens.sql).

alter table quick_add_tokens add column if not exists token_hash text;
alter table quick_add_tokens add column if not exists last_used_at timestamptz;

-- Rellena el hash de los tokens que ya existan.
update quick_add_tokens
   set token_hash = encode(digest(token, 'sha256'), 'hex')
 where token_hash is null;

create unique index if not exists quick_add_tokens_token_hash_key
  on quick_add_tokens (token_hash);

-- Permite al usuario revocar su propio token (hoy solo puede leer, crear y actualizar).
drop policy if exists "delete own quick add token" on quick_add_tokens;
create policy "delete own quick add token" on quick_add_tokens
  for delete using (auth.uid() = user_id);
