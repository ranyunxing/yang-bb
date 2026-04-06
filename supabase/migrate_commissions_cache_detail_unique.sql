-- 目的：
-- 1) 允许 commissions_cache 明细全保留（order_id 不再作为唯一键）
-- 2) 使用联盟侧明细唯一标识（source_transaction_id）做去重
-- 3) 兼容已存在的 idx_commissions_cache_unique 唯一索引命名
--
-- 适用场景：
-- - 你的 commissions_cache 早期用 (network_id, account_id, order_id) 做唯一约束
-- - 同一 order_id 可能对应多条佣金明细，导致批量插入失败或数据丢失
--
-- 执行方式：
-- - 在 Supabase SQL Editor 里执行（public schema）
-- - 可重复执行（IF EXISTS / IF NOT EXISTS）

BEGIN;

-- 0) 增加明细级唯一标识字段（若不存在）
ALTER TABLE public.commissions_cache
ADD COLUMN IF NOT EXISTS source_transaction_id text;

-- 1) 删除旧的唯一索引（如果它仍然基于 order_id，会导致整批插入失败）
DROP INDEX IF EXISTS public.idx_commissions_cache_unique;

-- 2) 创建新的唯一索引：同一联盟同一账号下，按明细唯一标识去重
CREATE UNIQUE INDEX IF NOT EXISTS idx_commissions_cache_unique
ON public.commissions_cache (network_id, account_id, source_transaction_id)
WHERE source_transaction_id IS NOT NULL;

-- 3) 为 order_id 建普通索引（可选但常用）
CREATE INDEX IF NOT EXISTS idx_commissions_cache_order_id
ON public.commissions_cache (order_id)
WHERE order_id IS NOT NULL;

-- 4)（可选）如果你依赖 commissions_cache_view，确保视图包含 source_transaction_id
-- 注意：如果你的视图定义不同，可根据实际字段调整
CREATE OR REPLACE VIEW public.commissions_cache_view AS
SELECT
  c.id,
  c.network_id,
  nc.name AS network_name,
  nc.type AS network_type,
  c.account_id,
  na.account_name,
  c.source_transaction_id,
  c.order_id,
  c.order_time,
  c.merchant_name,
  c.sale_amount,
  c.commission,
  c.status,
  c.currency,
  c.customer_country,
  c.brand_id,
  c.mcid,
  c.paid_status,
  c.original_data,
  c.created_at,
  c.updated_at
FROM public.commissions_cache c
LEFT JOIN public.network_configs nc ON c.network_id = nc.id
LEFT JOIN public.network_accounts na ON c.account_id = na.id;

COMMIT;

