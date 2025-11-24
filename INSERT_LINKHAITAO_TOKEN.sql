-- ========================================
-- 插入 Linkhaitao Token 的完整 SQL
-- ========================================

-- 第一步：查询 Linkhaitao 联盟的 ID
-- 如果你已经知道 ID，可以跳过这一步
SELECT id, name FROM network_configs WHERE type = 'linkhaitao';

-- 第二步：插入 Token（二选一）
-- 方式 A：手动替换 UUID
-- 将下面 SQL 中的 'YOUR_ACTUAL_TOKEN_HERE' 替换为你的真实 token
-- 将 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' 替换为上面查询到的 ID

-- INSERT INTO network_accounts (network_id, token, account_name, is_active)
-- VALUES (
--     'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',  -- ⚠️ 替换为 Linkhaitao 的 ID
--     'YOUR_ACTUAL_TOKEN_HERE',                 -- ⚠️ 替换为你的真实 token
--     '我的 Linkhaitao 账号',                    -- 改成你想显示的名称
--     true
-- );

-- 方式 B：自动查询 ID（推荐）
-- 只需要替换 token 和账号名称，不需要手动查 ID
INSERT INTO network_accounts (network_id, token, account_name, is_active)
SELECT 
    id,                                     -- 自动使用 Linkhaitao 的 ID
    'YOUR_ACTUAL_TOKEN_HERE',              -- ⚠️ 替换为你的真实 token
    '我的 Linkhaitao 账号',                -- 改成你想显示的名称
    true
FROM network_configs 
WHERE type = 'linkhaitao' 
LIMIT 1;

-- 第三步：验证是否插入成功
SELECT * FROM network_accounts_view WHERE network_type = 'linkhaitao';

