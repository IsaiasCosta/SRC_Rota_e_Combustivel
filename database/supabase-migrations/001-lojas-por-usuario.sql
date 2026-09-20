-- HISTÓRICO: MIGRAÇÃO JÁ EXECUTADA COM SUCESSO NO SUPABASE.
-- NÃO EXECUTAR NOVAMENTE. PRESERVAR ESTE ARQUIVO COMO REGISTRO.

BEGIN;

-- 1. Adicionar o proprietário de cada loja.
ALTER TABLE public.lojas
ADD COLUMN usuario_id UUID;

-- 2. Preservar a loja existente, vinculando-a à conta atual.
UPDATE public.lojas
SET usuario_id = 'f2dc8ed7-6063-4c2f-90df-95fd241892d3'::uuid
WHERE usuario_id IS NULL;
-- Interromper a migração se alguma loja ficar sem proprietário
-- ou se a loja existente não pertencer à conta atual.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.lojas
        WHERE usuario_id IS NULL
           OR (
               id = 1
               AND usuario_id <> 'f2dc8ed7-6063-4c2f-90df-95fd241892d3'::uuid
           )
    ) THEN
        RAISE EXCEPTION 'Migração interrompida: proprietário das lojas inválido.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.lojas
        WHERE id = 1
          AND usuario_id = 'f2dc8ed7-6063-4c2f-90df-95fd241892d3'::uuid
    ) THEN
        RAISE EXCEPTION 'Migração interrompida: loja existente não encontrada.';
    END IF;
END;
$$;

-- 3. Vincular automaticamente novas lojas ao usuário autenticado.
ALTER TABLE public.lojas
ALTER COLUMN usuario_id SET DEFAULT auth.uid();

-- 4. Impedir lojas sem proprietário.
ALTER TABLE public.lojas
ALTER COLUMN usuario_id SET NOT NULL;

-- 5. Garantir que o proprietário corresponda a um usuário existente.
ALTER TABLE public.lojas
ADD CONSTRAINT lojas_usuario_id_fkey
FOREIGN KEY (usuario_id)
REFERENCES auth.users(id);

-- 6. Garantir que a proteção por usuário esteja ativada.
ALTER TABLE public.lojas ENABLE ROW LEVEL SECURITY;

-- 7. Substituir a política antiga.
DROP POLICY IF EXISTS "Acesso privado as lojas" ON public.lojas;

-- 8. Permitir que cada usuário acesse somente suas lojas.
CREATE POLICY lojas_por_usuario
ON public.lojas
FOR ALL
TO authenticated
USING (usuario_id = (SELECT auth.uid()))
WITH CHECK (usuario_id = (SELECT auth.uid()));

-- 9. Remover permissões amplas de acesso à tabela.
REVOKE ALL PRIVILEGES ON TABLE public.lojas FROM anon, authenticated;

-- 10. Permitir somente as operações necessárias aos usuários autenticados.
-- As políticas RLS continuam limitando cada operação às lojas do próprio usuário.
GRANT SELECT ON TABLE public.lojas TO authenticated;

GRANT INSERT (
    nome,
    marca,
    endereco,
    cidade,
    estado,
    latitude,
    longitude,
    link_maps
) ON TABLE public.lojas TO authenticated;

GRANT UPDATE (
    nome,
    marca,
    endereco,
    cidade,
    estado,
    latitude,
    longitude,
    link_maps
) ON TABLE public.lojas TO authenticated;

-- 11. Remover permissões públicas da sequência de IDs.
REVOKE ALL PRIVILEGES ON SEQUENCE public.lojas_id_seq
FROM anon, authenticated;

-- 12. Permitir que usuários autenticados gerem IDs para novas lojas.
GRANT USAGE ON SEQUENCE public.lojas_id_seq
TO authenticated;

COMMIT;