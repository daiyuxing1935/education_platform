/**
 * draw.io 图表嵌入配置
 *
 * 可通过环境变量 VITE_DRAWIO_BASE_URL 自定义 draw.io 服务地址。
 * 默认使用官方 embed.diagrams.net，中国大陆用户可设置为镜像地址。
 *
 * 设置方法：
 *   .env 文件:  VITE_DRAWIO_BASE_URL=https://embed.diagrams.net
 *   Docker:     environment: VITE_DRAWIO_BASE_URL=https://embed.diagrams.net
 */

export const DRAWIO_CONFIG = {
  /** draw.io embed iframe 地址（可被 VITE_DRAWIO_BASE_URL 覆盖） */
  baseUrl: import.meta.env.VITE_DRAWIO_BASE_URL || 'https://embed.diagrams.net',

  /** iframe 加载超时（毫秒）*/
  timeoutMs: 25000,
}
