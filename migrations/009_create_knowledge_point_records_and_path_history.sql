-- 009: 知识点学习记录 + 路径调整历史
-- 用于学习路径 V2（基于思维导图的个性化学习系统）

-- 知识点学习记录表
CREATE TABLE IF NOT EXISTS knowledge_point_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    point_id UUID NOT NULL REFERENCES knowledge_points(id) ON DELETE CASCADE,
    point_name VARCHAR(200) NOT NULL,

    -- 掌握度
    mastery_score INTEGER NOT NULL DEFAULT 0,  -- 0-100 综合掌握度
    recent_accuracy INTEGER NOT NULL DEFAULT 0,  -- 最近5题正确率(0-100)

    -- 练习统计
    consecutive_errors INTEGER NOT NULL DEFAULT 0,
    total_practiced INTEGER NOT NULL DEFAULT 0,
    total_correct INTEGER NOT NULL DEFAULT 0,
    total_time_spent_seconds INTEGER NOT NULL DEFAULT 0,

    -- 学习行为
    study_count INTEGER NOT NULL DEFAULT 0,
    last_study_at TIMESTAMP,
    last_practice_at TIMESTAMP,

    -- 遗忘监测
    next_review_at TIMESTAMP,

    -- 状态
    status VARCHAR(20) NOT NULL DEFAULT 'not_started',
    -- not_started / learning / mastered / reviewing

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kpr_user_id ON knowledge_point_records(user_id);
CREATE INDEX idx_kpr_point_id ON knowledge_point_records(point_id);
CREATE UNIQUE INDEX idx_kpr_user_point ON knowledge_point_records(user_id, point_id);

-- 路径调整历史表
CREATE TABLE IF NOT EXISTS path_histories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    snapshot_data JSONB NOT NULL,
    agent_reason VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ph_user_id ON path_histories(user_id);
