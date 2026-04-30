-- Marca como comprável todos os itens que já têm preço cadastrado em alguma facção ou loja
UPDATE items
SET eh_compravel = true
WHERE id IN (
  SELECT item_id FROM faccao_item_precos
  UNION
  SELECT item_id FROM loja_item_precos
)
AND eh_compravel = false;
