const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

function envFlag(value) {
  return TRUE_VALUES.has(String(value || '').trim().toLowerCase());
}

export const MAINTENANCE_MODE = envFlag(import.meta.env.VITE_MAINTENANCE_MODE);
export const MAINTENANCE_TITLE = import.meta.env.VITE_MAINTENANCE_TITLE || 'LD士多维护中';
export const MAINTENANCE_MESSAGE = import.meta.env.VITE_MAINTENANCE_MESSAGE || '正在进行数据迁移，请稍后再试。';
export const MAINTENANCE_ETA = import.meta.env.VITE_MAINTENANCE_ETA || '';
