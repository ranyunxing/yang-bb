-- ============================================
-- 广告商系统完整设置 SQL
-- 此脚本包含所有必要的数据库修改，不影响佣金系统
-- ============================================

-- ============================================
-- 第一部分：修改 merchants 表结构
-- ============================================

-- 1. 先删除依赖视图
DROP VIEW IF EXISTS merchants_view;

-- 2. 删除不需要的字段
ALTER TABLE merchants DROP COLUMN IF EXISTS description;
ALTER TABLE merchants DROP COLUMN IF EXISTS category;

-- 3. 添加新字段
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS offer_type VARCHAR(50);
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS country VARCHAR(100);
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS support_region TEXT;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS relationship VARCHAR(50);
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS tracking_url_short TEXT;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS website_domain TEXT;

-- 4. 删除旧的索引（如果存在）
DROP INDEX IF EXISTS idx_merchants_name;
DROP INDEX IF EXISTS idx_merchants_mcid;
DROP INDEX IF EXISTS idx_merchants_network_id;
DROP INDEX IF EXISTS idx_merchants_account_id;

-- 5. 创建新的索引（包括搜索字段索引）
CREATE INDEX IF NOT EXISTS idx_merchants_name ON merchants(name);
CREATE INDEX IF NOT EXISTS idx_merchants_website ON merchants(website);
CREATE INDEX IF NOT EXISTS idx_merchants_website_domain ON merchants(website_domain);
CREATE INDEX IF NOT EXISTS idx_merchants_mcid ON merchants(mcid);
CREATE INDEX IF NOT EXISTS idx_merchants_brand_id ON merchants(brand_id);
CREATE INDEX IF NOT EXISTS idx_merchants_tracking_url_short ON merchants(tracking_url_short);
CREATE INDEX IF NOT EXISTS idx_merchants_network_id ON merchants(network_id);
CREATE INDEX IF NOT EXISTS idx_merchants_account_id ON merchants(account_id);

-- 6. 重新创建 merchants_view 视图
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

-- ============================================
-- 第二部分：添加广告商 API URL 字段
-- 注意：这是新字段，不会影响现有的 api_url（佣金系统使用）
-- ============================================

-- 7. 添加 merchant_api_url 字段到 network_configs 表
ALTER TABLE network_configs 
ADD COLUMN IF NOT EXISTS merchant_api_url TEXT;

-- 8. 更新 Partnermatic 的广告商 API URL
-- 佣金系统继续使用 api_url: https://api.partnermatic.com/api/transaction
-- 广告商系统使用 merchant_api_url: https://api.partnermatic.com/api/monetization
UPDATE network_configs
SET merchant_api_url = 'https://api.partnermatic.com/api/monetization',
    updated_at = NOW()
WHERE type = 'partnermatic';

-- ============================================
-- 第三部分：验证和查看结果
-- ============================================

-- 9. 验证 network_configs 表（确认两个 API URL 都存在且不同）
SELECT 
  name,
  type,
  api_url AS commission_api_url,        -- 佣金系统使用
  merchant_api_url AS merchant_api_url, -- 广告商系统使用
  is_active
FROM network_configs
WHERE type = 'partnermatic';

-- 10. 验证 merchants 表结构
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'merchants'
ORDER BY ordinal_position;

-- 11. 验证索引
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'merchants'
ORDER BY indexname;

-- ============================================
-- 完成！
-- 
-- 说明：
-- 1. merchants 表已更新，包含所有必要字段和索引
-- 2. network_configs 表已添加 merchant_api_url 字段
-- 3. Partnermatic 的广告商 API URL 已设置为: https://api.partnermatic.com/api/monetization
-- 4. 佣金系统不受影响，继续使用 api_url 字段
-- ============================================

