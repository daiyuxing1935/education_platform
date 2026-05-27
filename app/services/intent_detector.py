"""IntentDetector - 意图检测与知识盲区提取服务

分析用户聊天消息，判断是否为学习内容、是否暴露知识盲区。
独立服务，后续可包装为 LangGraph Agent 节点接入 PRD-007 工作流。
"""

import json
import httpx
import logging
from typing import Optional
from app.core.config import settings

logger = logging.getLogger(__name__)

INTENT_SYSTEM_PROMPT = """你是一个学习意图分析助手。分析用户输入，判断是否为学科学习相关内容。

学科范围包括但不限于：数学、计算机科学、物理、化学、生物、英语、历史、文学、政治、地理、哲学、经济学、工程学、医学、法学、教育学等。

请严格按照以下 JSON 格式输出，不要包含其他内容：
{
  "is_learning_related": true/false,
  "confidence": 0.0-1.0,
  "reason": "简短判断理由",
  "knowledge_points": [
    {"name": "知识点名称", "source": "explicit/implicit"}
  ]
}

判断标准：
1. is_learning_related: 用户提问是否属于学科学习范畴
2. confidence: 判断置信度（0-1）
3. knowledge_points: 用户消息中涉及的知识点列表
   - explicit: 用户明确提到了该知识点（如"我不懂红黑树"中的"红黑树"）
   - implicit: 用户隐晦涉及该知识点（如"排序好难"中的"排序算法"）
4. 如果用户表达"不懂"、"不理解"、"没学过"、"难"等负面表述，请在 knowledge_points 中标注
5. 如果明显不是学习内容（如问候、天气、娱乐等），is_learning_related 设为 false"""


class IntentDetector:
    """意图检测器：分析消息意图、提取知识盲区"""

    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or settings.QWEN_API_KEY or settings.DEEPSEEK_API_KEY
        # 优先使用 Qwen（轻量），回退 DeepSeek
        if settings.QWEN_API_KEY:
            self.base_url = base_url or settings.QWEN_BASE_URL
            self.model = model or "qwen-turbo-latest"
        else:
            self.base_url = base_url or settings.DEEPSEEK_BASE_URL
            self.model = model or "deepseek-chat"
        self.timeout = 15.0

    async def analyze(self, message: str) -> dict:
        """分析用户消息，返回意图和知识盲区"""
        if not self.api_key:
            return self._fallback_analysis(message)

        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            }

            payload = {
                "model": self.model,
                "messages": [
                    {"role": "system", "content": INTENT_SYSTEM_PROMPT},
                    {"role": "user", "content": message},
                ],
                "temperature": 0.1,
                "max_tokens": 500,
            }

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                )

                if response.status_code != 200:
                    logger.warning(f"意图检测 LLM 调用失败: {response.status_code}")
                    return self._fallback_analysis(message)

                result = response.json()
                content = result["choices"][0]["message"]["content"].strip()

                # 提取 JSON
                return self._parse_json_response(content, message)

        except httpx.TimeoutException:
            logger.warning("意图检测 LLM 超时，使用回退逻辑")
            return self._fallback_analysis(message)
        except Exception as e:
            logger.error(f"意图检测失败: {e}", exc_info=True)
            return self._fallback_analysis(message)

    def _parse_json_response(self, content: str, original_message: str) -> dict:
        """从 LLM 回复中提取 JSON"""
        try:
            # 尝试直接解析
            if content.startswith("{"):
                return json.loads(content)
            # 尝试从 markdown 代码块中提取
            if "```json" in content:
                start = content.find("```json") + 7
                end = content.find("```", start)
                return json.loads(content[start:end].strip())
            if "```" in content:
                start = content.find("```") + 3
                end = content.find("```", start)
                return json.loads(content[start:end].strip())
            # 尝试找第一个 { 和最后一个 }
            start = content.find("{")
            end = content.rfind("}") + 1
            if start >= 0 and end > start:
                return json.loads(content[start:end])
        except (json.JSONDecodeError, ValueError) as e:
            logger.warning(f"JSON 解析失败: {e}, raw: {content[:100]}")

        return self._fallback_analysis(original_message)

    def _fallback_analysis(self, message: str) -> dict:
        """回退分析：基于规则的简单判断"""
        message_lower = message.lower()

        # 检查是否可能为学习内容（基于关键词）
        learning_keywords = [
            "什么是", "怎么", "如何", "为什么", "不懂", "不理解", "不会",
            "原理", "概念", "定义", "算法", "函数", "方程", "定理", "公式",
            "证明", "推导", "计算", "分析", "设计", "实现",
            "数学", "物理", "化学", "计算机", "编程", "代码",
            "作业", "考试", "题", "练习", "学习", "知识点",
            "排序", "搜索", "树", "图", "表", "结构",
            "class", "function", "method", "api", "http",
        ]

        is_learning = any(kw in message_lower for kw in learning_keywords)

        if is_learning:
            return {
                "is_learning_related": True,
                "confidence": 0.6,
                "reason": "基于关键词匹配判断为学习相关内容",
                "knowledge_points": [],
            }
        else:
            return {
                "is_learning_related": True,  # 默认视为学习内容，宁放过不误伤
                "confidence": 0.5,
                "reason": "无法明确判断，默认视为学习内容",
                "knowledge_points": [],
            }


# 全局单例
_intent_detector: Optional[IntentDetector] = None


def get_intent_detector() -> IntentDetector:
    global _intent_detector
    if _intent_detector is None:
        _intent_detector = IntentDetector()
    return _intent_detector
