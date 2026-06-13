import { api } from '@/utils/api'

function toRequestError(error, fallback) {
  return { success: false, error: error?.message || fallback }
}

export async function fetchMerchantConfigRequest() {
  try {
    return await api.get('/api/shop/merchant/config')
  } catch (error) {
    return toRequestError(error, '加载商户配置失败，请稍后重试')
  }
}

export async function updateMerchantConfigRequest(config) {
  try {
    return await api.put('/api/shop/merchant/config', config)
  } catch (error) {
    return toRequestError(error, '更新商户配置失败，请稍后重试')
  }
}
