-- KnowledgeResource — 增加 is_public 字段
-- 代码案例等公共资源对所有用户可见

ALTER TABLE knowledge_resources
ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;

-- 将现有 code_case 资源标记为公开
UPDATE knowledge_resources
SET is_public = TRUE
WHERE resource_type = 'code_case';

CREATE INDEX IF NOT EXISTS idx_knowledge_resources_is_public
ON knowledge_resources(is_public);

CREATE INDEX IF NOT EXISTS idx_knowledge_resources_public_type
ON knowledge_resources(is_public, resource_type);
