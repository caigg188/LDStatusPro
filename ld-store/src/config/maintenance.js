const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

function envFlag(value) {
  return TRUE_VALUES.has(String(value || '').trim().toLowerCase());
}

// Emergency switch for the current backend outage. Turn this off after recovery.
const TEMPORARY_MAINTENANCE_ENABLED = false;

const DEFAULT_TITLE = 'LD士多临时维护中';
const DEFAULT_MESSAGE = '由于后端云服务器目前出现异常，LD士多服务暂时不可用，现正进行临时维护与恢复。';
const DEFAULT_ETA = '恢复时间待确认，请稍后刷新或查看状态页。';
const DEFAULT_STATUS_URL = 'https://status.ldspro.qzz.io/';

export const MAINTENANCE_MODE =
  TEMPORARY_MAINTENANCE_ENABLED || envFlag(import.meta.env.VITE_MAINTENANCE_MODE);
export const MAINTENANCE_TITLE = import.meta.env.VITE_MAINTENANCE_TITLE || DEFAULT_TITLE;
export const MAINTENANCE_MESSAGE = import.meta.env.VITE_MAINTENANCE_MESSAGE || DEFAULT_MESSAGE;
export const MAINTENANCE_ETA = import.meta.env.VITE_MAINTENANCE_ETA || DEFAULT_ETA;
export const MAINTENANCE_STATUS_URL =
  import.meta.env.VITE_MAINTENANCE_STATUS_URL || DEFAULT_STATUS_URL;
