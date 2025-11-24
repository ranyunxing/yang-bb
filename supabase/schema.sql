-- 联盟配置表
-- 存储每个联盟的基本信息和 API 地址
CREATE TABLE IF NOT EXISTS network_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),           -- 联盟ID（主键，自动生成）
  name VARCHAR(100) NOT NULL,                              -- 联盟名称（如：Partnermatic）
  type VARCHAR(50) NOT NULL,                               -- 联盟类型（如：partnermatic, linkbux, linkhaitao）
  api_url TEXT NOT NULL,                                   -- 该联盟的佣金报告 API 地址
  merchant_api_url TEXT,                                   -- 该联盟的广告商 API 地址（可选）
  is_active BOOLEAN DEFAULT true,                          -- 是否启用
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),       -- 创建时间
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()        -- 更新时间
);

-- 联盟账号表
-- 存储每个联盟下的账号（一个联盟可以有多个账号，每个账号对应不同的 token）
CREATE TABLE IF NOT EXISTS network_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),           -- 账号ID（主键，自动生成）
  network_id UUID NOT NULL REFERENCES network_configs(id) ON DELETE CASCADE,  -- 所属联盟ID（外键）
  token TEXT NOT NULL,                                     -- API Token（用于获取该账号的佣金数据）
  account_name VARCHAR(200) NOT NULL,                      -- 账号名称（方便识别，如：个人账号、公司账号）
  is_active BOOLEAN DEFAULT true,                          -- 是否启用
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),       -- 创建时间
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()        -- 更新时间
);

-- 广告商表
-- 存储广告商列表数据，每个广告商关联到特定的账号（token）
CREATE TABLE IF NOT EXISTS merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),           -- 广告商ID（主键，自动生成）
  name VARCHAR(200) NOT NULL,                              -- 广告商名称
  website TEXT,                                            -- 广告商网站
  website_domain TEXT,                                     -- 规范化后的域名（去协议/后缀）
  network_id UUID REFERENCES network_configs(id) ON DELETE SET NULL,  -- 所属联盟ID
  account_id UUID REFERENCES network_accounts(id) ON DELETE CASCADE,  -- 所属账号ID（重要：每个账号的广告商列表不同）
  mcid VARCHAR(100),                                       -- 商户代码（联盟提供的标识）
  brand_id VARCHAR(100),                                   -- 品牌ID（联盟提供的标识）
  offer_type VARCHAR(50),                                  -- 报价类型
  country VARCHAR(100),                                    -- 国家
  support_region TEXT,                                     -- 支持区域
  relationship VARCHAR(50),                                -- 关系类型
  tracking_url_short TEXT,                                 -- 短链接
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),       -- 创建时间
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()        -- 更新时间
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_network_configs_type ON network_configs(type);
CREATE INDEX IF NOT EXISTS idx_network_configs_active ON network_configs(is_active);
CREATE INDEX IF NOT EXISTS idx_network_accounts_network_id ON network_accounts(network_id);
CREATE INDEX IF NOT EXISTS idx_network_accounts_active ON network_accounts(is_active);
CREATE INDEX IF NOT EXISTS idx_merchants_name ON merchants(name);
CREATE INDEX IF NOT EXISTS idx_merchants_website ON merchants(website);
CREATE INDEX IF NOT EXISTS idx_merchants_website_domain ON merchants(website_domain);
CREATE INDEX IF NOT EXISTS idx_merchants_mcid ON merchants(mcid);
CREATE INDEX IF NOT EXISTS idx_merchants_brand_id ON merchants(brand_id);
CREATE INDEX IF NOT EXISTS idx_merchants_tracking_url_short ON merchants(tracking_url_short);
CREATE INDEX IF NOT EXISTS idx_merchants_network_id ON merchants(network_id);
CREATE INDEX IF NOT EXISTS idx_merchants_account_id ON merchants(account_id);

-- 插入初始数据示例
-- Partnermatic 联盟配置
INSERT INTO network_configs (name, type, api_url, is_active)
VALUES ('Partnermatic', 'partnermatic', 'https://api.partnermatic.com/api/transaction', true)
ON CONFLICT DO NOTHING;

-- Linkhaitao 联盟配置
INSERT INTO network_configs (name, type, api_url, is_active)
VALUES ('Linkhaitao', 'linkhaitao', 'https://www.linkhaitao.com/api.php', true)
ON CONFLICT DO NOTHING;

-- Linkbux 联盟配置
INSERT INTO network_configs (name, type, api_url, is_active)
VALUES ('Linkbux', 'linkbux', 'https://www.linkbux.com/api.php', true)
ON CONFLICT DO NOTHING;

-- 获取刚插入的联盟 ID（用于插入账号）
-- 注意：这部分在 Supabase Dashboard 中手动执行，或者通过代码动态插入

-- 示例账号（token 需要替换为实际值）
-- INSERT INTO network_accounts (network_id, token, account_name, is_active)
-- SELECT id, 'your_actual_token_here', '我的 Partnermatic 账号', true
-- FROM network_configs WHERE type = 'partnermatic' LIMIT 1;

-- INSERT INTO network_accounts (network_id, token, account_name, is_active)
-- SELECT id, 'your_actual_token_here', '我的 Linkhaitao 账号', true
-- FROM network_configs WHERE type = 'linkhaitao' LIMIT 1;

-- INSERT INTO network_accounts (network_id, token, account_name, is_active)
-- SELECT id, 'your_actual_token_here', '我的 Linkbux 账号', true
-- FROM network_configs WHERE type = 'linkbux' LIMIT 1;

-- 创建视图：让 network_accounts 表显示联盟名称而不是 UUID
CREATE OR REPLACE VIEW network_accounts_view AS
SELECT 
    na.id,
    na.network_id,
    nc.name AS network_name,           -- 显示联盟名称（如：Partnermatic）
    nc.type AS network_type,            -- 显示联盟类型（如：partnermatic）
    na.token,
    na.account_name,
    na.is_active,
    na.created_at,
    na.updated_at
FROM network_accounts na
JOIN network_configs nc ON na.network_id = nc.id;

-- 创建视图：让 merchants 表显示联盟名称和账号名称而不是 UUID
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
