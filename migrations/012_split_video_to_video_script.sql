-- 迁移：拆分 video 类型为 video_script（视频脚本）和 video（视频讲解）
--
-- resource_gen.py 生成的 video 资源实际是视频脚本文本 → 改为 video_script
-- video_resources.py 生成的 video 资源是完整视频讲解 → 保持 video 不变

-- 将 resource_gen（source='agent_generated'）生成的视频资源改为 video_script
UPDATE knowledge_resources
SET resource_type = 'video_script'
WHERE resource_type = 'video'
  AND source = 'agent_generated';

-- 将 tags 中包含 'agent_generated' 的 video 资源也改为 video_script
-- （兼容不同 source 命名）
UPDATE knowledge_resources
SET resource_type = 'video_script'
WHERE resource_type = 'video'
  AND tags @> '["agent_generated"]'::jsonb
  AND source != 'manual';

-- 将 document 类型中标题含"视频脚本"的资源改为 video_script
-- （旧版批量生成时将视频脚本错误地存为 document 类型）
UPDATE knowledge_resources
SET resource_type = 'video_script'
WHERE resource_type = 'document'
  AND title LIKE '%视频脚本%';
