#!/usr/bin/env python3
"""Unsplash 图片搜索 MCP Server

为 Claude Code 提供图片搜索工具，可在编辑前端代码时检索高清图片。

运行方式（由 Claude Code 自动启动）：
  python mcp_servers/unsplash_search.py

环境变量：
  UNSPLASH_ACCESS_KEY: Unsplash API Access Key（必填）

工具：
  - search_unsplash: 按关键词搜索图片，返回图片URL列表
"""

import os
import sys
import json
import logging

logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger("unsplash-mcp")

# 确保项目根目录在 sys.path 中
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


async def main():
    from mcp.server import Server
    from mcp.server.stdio import stdio_server
    from mcp.types import Tool, TextContent
    from app.services.unsplash_service import UnsplashService

    access_key = os.environ.get("UNSPLASH_ACCESS_KEY", "")
    if not access_key:
        logger.warning("UNSPLASH_ACCESS_KEY 未设置，搜索将返回空结果")

    service = UnsplashService(access_key=access_key)

    server = Server(
        "unsplash-search",
        version="1.0.0",
        instructions="Unsplash 高清图片搜索工具",
    )

    @server.list_tools()
    async def handle_list_tools():
        return [
            Tool(
                name="search_unsplash",
                description=(
                    "搜索 Unsplash 高清图片，根据关键词返回图片URL列表。"
                    "可用于视频配图、文章插图、页面背景等场景。"
                    "支持中英文关键词，返回的图片均为高质量商用许可图片。"
                ),
                inputSchema={
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "搜索关键词，支持中文（如：海洋、科技、教育、编程）",
                        },
                        "per_page": {
                            "type": "number",
                            "description": "返回图片数量，范围 1-30，默认 10",
                            "default": 10,
                        },
                        "orientation": {
                            "type": "string",
                            "description": "图片方向：landscape(横屏) / portrait(竖屏) / squarish(方形)",
                            "enum": ["landscape", "portrait", "squarish"],
                            "default": "landscape",
                        },
                    },
                    "required": ["query"],
                },
            )
        ]

    @server.call_tool()
    async def handle_call_tool(name: str, arguments: dict) -> list:
        if name != "search_unsplash":
            raise ValueError(f"Unknown tool: {name}")

        query = arguments.get("query", "")
        per_page = arguments.get("per_page", 10)
        orientation = arguments.get("orientation", "landscape")

        if not query:
            return [TextContent(type="text", text="请提供搜索关键词")]

        results = await service.search_photos(query, per_page, orientation)

        if not results:
            if not access_key:
                return [
                    TextContent(
                        type="text",
                        text="UNSPLASH_ACCESS_KEY 未配置，请在 MCP 服务器配置中设置环境变量 UNSPLASH_ACCESS_KEY",
                    )
                ]
            return [TextContent(type="text", text=f"未找到关键词「{query}」的相关图片")]

        # 格式化输出结果
        lines = [f"找到 {len(results)} 张「{query}」相关图片：\n"]
        for i, img in enumerate(results, 1):
            lines.append(f"[{i}] {img['description'] or '无描述'}")
            lines.append(f"    作者：{img['author']}")
            lines.append(f"    尺寸：{img['width']}x{img['height']}")
            lines.append(f"    原图：{img['url_raw']}&w=1920")
            lines.append(f"    展示：{img['url_regular']}")
            lines.append(f"    缩略：{img['url_thumb']}")
            lines.append("")

        return [TextContent(type="text", text="\n".join(lines))]

    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options(),
            raise_exceptions=True,
        )


if __name__ == "__main__":
    import anyio
    anyio.run(main)
