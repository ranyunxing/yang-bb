-- ============================================
-- 增量脚本：为 merchants 表添加 website_domain 字段
-- 如果之前已经执行 setup_merchants_system.sql，可跳过
-- ============================================

-- 1. 删除依赖视图
DROP VIEW IF EXISTS merchants_view;

-- 2. 添加字段
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS website_domain TEXT;

-- 3. 创建索引
CREATE INDEX IF NOT EXISTS idx_merchants_website_domain ON merchants(website_domain);

-- 4. 重新创建视图
CREATE OR REPLACE VIEW merchants_view AS
SELECT 
    m.id,
    m.network_id,
    nc.name AS network_name,
    nc.type AS network_type,
    m.account_id,
    na.account_name,
    na.token,
    m.name AS merchant_name,
    m.website,
    m.website_domain,
    m.mcid,
    m.brand_id,
    m.offer_type,
    m.country,
    m.support_region,
    m.relationship,
    m.tracking_url_short,
    m.created_at,
    m.updated_at
FROM merchants m
LEFT JOIN network_configs nc ON m.network_id = nc.id
LEFT JOIN network_accounts na ON m.account_id = na.id;

-- 5. 验证
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'merchants'
ORDER BY ordinal_position;

SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'merchants'
ORDER BY indexname;

