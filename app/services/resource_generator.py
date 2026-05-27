"""ResourceGenerator - 学习资源生成服务

根据知识点名称，调用 LLM 生成 Markdown 格式的思维导图内容。
生成的 Markdown 可直接由 markmap-lib 渲染为 SVG 思维导图。
"""

import json
import httpx
import logging
from typing import Optional, List
from app.core.config import settings

logger = logging.getLogger(__name__)

GENERATOR_SYSTEM_PROMPT = """你是一个学习资源生成助手。根据用户指定的知识点，生成结构化的 Markdown 思维导图内容。

格式要求：
1. 第一行为 "# 知识点名称"（一级标题）
2. 使用 ## 表示子主题（二级标题）
3. 使用 - 表示列表项
4. 使用缩进（2空格）表示层级关系
5. 确保内容准确、条理清晰、层次分明

示例格式：
# Python 变量类型
## 数字类型
- int（整数）
- float（浮点数）
- complex（复数）
## 字符串
- 定义：使用引号包裹
- 方法：split, join, replace
## 布尔类型
- True / False
- 逻辑运算：and, or, not

注意：
- 只输出 Markdown 内容，不要额外解释
- 内容要适度，每个知识点3-6个子主题
- 考虑知识点的核心概念、分类、原理、应用场景
"""


class ResourceGenerator:
    """资源生成器：调用 LLM 生成思维导图 Markdown 内容"""

    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or settings.QWEN_API_KEY or settings.DEEPSEEK_API_KEY
        if api_key and base_url and model:
            # 用户提供了完整的 provider 配置（含 model）
            self.base_url = base_url
            self.model = model
        elif api_key and base_url:
            # 有 key 和 base_url 但无 model，尝试从 base_url 判断
            self.base_url = base_url
            if "deepseek" in base_url.lower():
                self.model = "deepseek-chat"
            else:
                self.model = "qwen-turbo-latest"
        elif settings.QWEN_API_KEY:
            self.base_url = settings.QWEN_BASE_URL
            self.model = "qwen-turbo-latest"
        else:
            self.base_url = settings.DEEPSEEK_BASE_URL
            self.model = "deepseek-chat"
        self.timeout = 30.0

    async def generate_mindmap(self, knowledge_points: List[str]) -> Optional[str]:
        """为指定知识点生成思维导图 Markdown 内容"""
        if not self.api_key:
            logger.warning("未配置 API Key，无法生成思维导图")
            return None

        if not knowledge_points:
            return None

        topic = "、".join(knowledge_points)
        user_prompt = f"请为我生成关于「{topic}」的思维导图内容，覆盖核心概念、分类、原理和应用场景。"

        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            }

            payload = {
                "model": self.model,
                "messages": [
                    {"role": "system", "content": GENERATOR_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": 0.7,
                "max_tokens": 2048,
            }

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                )

            if response.status_code != 200:
                logger.error(f"LLM 调用失败: {response.status_code} {response.text}")
                return None

            result = response.json()
            content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
            if not content:
                logger.warning("LLM 返回内容为空")
                return None

            # 清理可能的 markdown 代码块包装
            content = content.strip()
            if content.startswith("```markdown"):
                content = content[11:]
            elif content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]

            return content.strip()

        except httpx.TimeoutException:
            logger.error(f"LLM 请求超时 (timeout={self.timeout}s)")
            return None
        except Exception as e:
            logger.error(f"LLM 请求异常: {e}")
            return None
