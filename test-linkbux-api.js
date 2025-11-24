/**
 * Linkbux API 测试脚本
 * 用于直接测试 API 是否返回今天和昨天的数据
 */

const axios = require('axios');

// 从环境变量获取 token，或者在这里直接填写
const LINKBUX_TOKEN = process.env.LINKBUX_TOKEN || 'YOUR_TOKEN_HERE';

// 日期格式化函数
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 测试函数
async function testLinkbuxAPI(beginDate, endDate, label) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`测试: ${label}`);
  console.log(`日期范围: ${beginDate} 至 ${endDate}`);
  console.log('='.repeat(60));
  
  const url = `https://www.linkbux.com/api.php?mod=medium&op=transaction_v3&token=${LINKBUX_TOKEN}&begin_date=${beginDate}&end_date=${endDate}&page=1&limit=1000`;
  
  console.log('🔗 请求 URL:', url.replace(LINKBUX_TOKEN, 'xxx'));
  
  try {
    const response = await axios.get(url);
    
    console.log('\n📊 响应状态:');
    console.log('  - Code:', response.data.status.code);
    console.log('  - Message:', response.data.status.msg);
    
    if (response.data.data) {
      console.log('  - Total Page:', response.data.data.total_page);
      console.log('  - Total Count:', response.data.data.total);
      console.log('  - List Length:', response.data.data.list?.length || 0);
      
      if (response.data.data.list && response.data.data.list.length > 0) {
        console.log('\n📦 数据样本:');
        const firstItem = response.data.data.list[0];
        console.log('  - 第一条订单:');
        console.log('    - Order ID:', firstItem.order_id);
        console.log('    - Order Time:', firstItem.order_time);
        console.log('    - Order Time (ISO):', new Date(firstItem.order_time * 1000).toISOString());
        console.log('    - Merchant:', firstItem.merchant_name);
        
        const lastItem = response.data.data.list[response.data.data.list.length - 1];
        console.log('  - 最后一条订单:');
        console.log('    - Order ID:', lastItem.order_id);
        console.log('    - Order Time:', lastItem.order_time);
        console.log('    - Order Time (ISO):', new Date(lastItem.order_time * 1000).toISOString());
        console.log('    - Merchant:', lastItem.merchant_name);
      } else {
        console.log('\n⚠️  没有返回数据');
      }
    }
    
    return response.data;
  } catch (error) {
    console.error('\n❌ 请求失败:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', error.response.data);
    }
    return null;
  }
}

// 主测试流程
async function main() {
  console.log('🚀 开始测试 Linkbux API');
  console.log(`📅 当前时间: ${new Date().toISOString()}`);
  
  if (LINKBUX_TOKEN === 'YOUR_TOKEN_HERE') {
    console.error('\n❌ 错误: 请设置 LINKBUX_TOKEN 环境变量或在脚本中填写 token');
    console.log('使用方法: LINKBUX_TOKEN=your_token node test-linkbux-api.js');
    process.exit(1);
  }
  
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const todayStr = formatDate(today);
  const yesterdayStr = formatDate(yesterday);
  
  // 测试1: 今天
  await testLinkbuxAPI(todayStr, todayStr, '今天');
  
  // 延迟一秒避免 API 限流
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // 测试2: 昨天
  await testLinkbuxAPI(yesterdayStr, yesterdayStr, '昨天');
  
  // 延迟一秒
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // 测试3: 近7天
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const sevenDaysAgoStr = formatDate(sevenDaysAgo);
  await testLinkbuxAPI(sevenDaysAgoStr, todayStr, '近7天');
  
  // 延迟一秒
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // 测试4: 10月26日 至 11月1日
  await testLinkbuxAPI('2025-10-26', '2025-11-01', '10月26日 至 11月1日');
  
  console.log('\n✅ 测试完成');
}

main().catch(console.error);

