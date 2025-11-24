-- ============================================
-- 佣金数据缓存表结构
-- 用于存储从联盟 API 获取的佣金数据
-- ============================================

-- 1. 创建佣金数据表
CREATE TABLE IF NOT EXISTS commissions_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),           -- 主键ID
  network_id UUID NOT NULL REFERENCES network_configs(id) ON DELETE CASCADE,  -- 联盟ID
  account_id UUID NOT NULL REFERENCES network_accounts(id) ON DELETE CASCADE,  -- 账号ID
  order_id VARCHAR(255),                                   -- 订单ID（用于去重）
  order_time BIGINT NOT NULL,                              -- 订单时间戳（毫秒）
  merchant_name VARCHAR(500),                              -- 商家名称
  sale_amount NUMERIC(15, 2) DEFAULT 0,                    -- 销售额
  commission NUMERIC(15, 2) DEFAULT 0,                     -- 佣金
  status VARCHAR(50),                                      -- 状态（Pending/Approved/Rejected）
  currency VARCHAR(10) DEFAULT 'USD',                      -- 币种
  customer_country VARCHAR(100),                           -- 客户国家
  brand_id VARCHAR(100),                                   -- 品牌ID
  mcid VARCHAR(100),                                       -- MCID
  paid_status INTEGER,                                     -- 支付状态：0=未支付，1=已支付
  network_type VARCHAR(50),                                -- 联盟类型（partnermatic/linkbux/linkhaitao）
  original_data JSONB,                                     -- 原始数据（JSON格式，保留所有字段）
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),       -- 创建时间
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()        -- 更新时间
);

-- 2. 创建唯一约束（用于去重）
-- 使用 (network_id, account_id, order_id) 作为唯一标识
CREATE UNIQUE INDEX IF NOT EXISTS idx_commissions_cache_unique 
ON commissions_cache(network_id, account_id, order_id) 
WHERE order_id IS NOT NULL;

-- 3. 创建索引（用于快速查询）
-- 时间范围索引（最重要，几乎所有查询都需要）
CREATE INDEX IF NOT EXISTS idx_commissions_cache_order_time 
ON commissions_cache(order_time);

-- MCID 索引（常用筛选字段）
CREATE INDEX IF NOT EXISTS idx_commissions_cache_mcid 
ON commissions_cache(mcid) 
WHERE mcid IS NOT NULL;

-- 品牌ID 索引（常用筛选字段）
CREATE INDEX IF NOT EXISTS idx_commissions_cache_brand_id 
ON commissions_cache(brand_id) 
WHERE brand_id IS NOT NULL;

-- 商家名称索引（可选，支持模糊搜索）
CREATE INDEX IF NOT EXISTS idx_commissions_cache_merchant_name 
ON commissions_cache(merchant_name) 
WHERE merchant_name IS NOT NULL;

-- 状态索引（用于状态筛选）
CREATE INDEX IF NOT EXISTS idx_commissions_cache_status 
ON commissions_cache(status) 
WHERE status IS NOT NULL;

-- 联盟ID + 账号ID 索引（用于快速定位）
CREATE INDEX IF NOT EXISTS idx_commissions_cache_network_account 
ON commissions_cache(network_id, account_id);

-- 复合索引：MCID + 时间（常用组合查询）
CREATE INDEX IF NOT EXISTS idx_commissions_cache_mcid_time 
ON commissions_cache(mcid, order_time) 
WHERE mcid IS NOT NULL;

-- 复合索引：品牌ID + 时间（常用组合查询）
CREATE INDEX IF NOT EXISTS idx_commissions_cache_brand_time 
ON commissions_cache(brand_id, order_time) 
WHERE brand_id IS NOT NULL;

-- 4. 创建更新时间触发器（自动更新 updated_at）
CREATE OR REPLACE FUNCTION update_commissions_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_commissions_cache_updated_at
BEFORE UPDATE ON commissions_cache
FOR EACH ROW
EXECUTE FUNCTION update_commissions_cache_updated_at();

-- 5. 创建视图（方便查询，显示联盟名称和账号名称）
CREATE OR REPLACE VIEW commissions_cache_view AS
SELECT 
  c.id,
  c.network_id,
  nc.name AS network_name,
  nc.type AS network_type,
  c.account_id,
  na.account_name,
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
FROM commissions_cache c
LEFT JOIN network_configs nc ON c.network_id = nc.id
LEFT JOIN network_accounts na ON c.account_id = na.id;

-- 6. 验证表结构
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'commissions_cache'
ORDER BY ordinal_position;

-- 7. 验证索引
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'commissions_cache'
ORDER BY indexname;

-- ============================================
-- 使用说明：
-- 1. 执行此脚本创建佣金数据缓存表
-- 2. 表结构设计支持全量替换策略（DELETE + INSERT）
-- 3. 索引优化了常用查询字段（mcid, brand_id, merchant_name, order_time）
-- 4. 唯一约束 (network_id, account_id, order_id) 用于去重
-- ============================================

