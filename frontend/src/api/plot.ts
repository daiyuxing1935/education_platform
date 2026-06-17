import api from './auth'

export interface PlotExecuteResponse {
  image: string | null
  stdout: string
  stderr: string
  success: boolean
}

export const plotApi = {
  /** 执行 matplotlib 代码并返回生成的图表图片 */
  execute: (code: string) =>
    api.post<PlotExecuteResponse>('/code/plot', { code }),
}
