-- ============================================
-- 修改 merchants 表结构
-- 删除不需要的字段，添加新字段，更新索引
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

-- 4. 删除旧的索引（如果存在）
DROP INDEX IF EXISTS idx_merchants_name;
DROP INDEX IF EXISTS idx_merchants_mcid;
DROP INDEX IF EXISTS idx_merchants_network_id;
DROP INDEX IF EXISTS idx_merchants_account_id;

-- 5. 创建新的索引（包括搜索字段索引）
CREATE INDEX IF NOT EXISTS idx_merchants_name ON merchants(name);
CREATE INDEX IF NOT EXISTS idx_merchants_website ON merchants(website);
CREATE INDEX IF NOT EXISTS idx_merchants_mcid ON merchants(mcid);
CREATE INDEX IF NOT EXISTS idx_merchants_brand_id ON merchants(brand_id);
CREATE INDEX IF NOT EXISTS idx_merchants_tracking_url_short ON merchants(tracking_url_short);
CREATE INDEX IF NOT EXISTS idx_merchants_network_id ON merchants(network_id);
CREATE INDEX IF NOT EXISTS idx_merchants_account_id ON merchants(account_id);

-- 6. 重新创建 merchants_view 视图（删除 description 和 category，添加新字段）
CREATE OR REPLACE VIEW merchants_view AS
SELECT 
    m.id,
    m.network_id,
    nc.name AS network_name,           -- 显示联盟名称
    nc.type AS network_type,            -- 显示联盟类型
    m.account_id,
    na.account_name,                    -- 显示账号名称
    na.token,                           -- 显示账号 token
    m.name AS merchant_name,
    m.website,
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

