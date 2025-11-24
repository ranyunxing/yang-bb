import { supabaseServer } from '../supabase/server'
import type { NetworkConfig } from '@/types'

/**
 * 获取所有联盟配置
 */
export async function getAllNetworks(): Promise<NetworkConfig[]> {
  const { data, error } = await supabaseServer
    .from('network_configs')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true })
  
  if (error) {
    console.error('获取联盟配置失败:', error)
    throw error
  }
  
  // 转换数据库字段名到 TypeScript 接口
  return (data || []).map(item => ({
    id: item.id,
    name: item.name,
    type: item.type,
    apiUrl: item.api_url,
    merchantApiUrl: item.merchant_api_url || undefined,
    isActive: item.is_active,
    createdAt: item.created_at,
    updatedAt: item.updated_at
  }))
}

