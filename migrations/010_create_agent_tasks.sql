-- AgentTask — 多智能体协同任务表
CREATE TABLE IF NOT EXISTS agent_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- 任务输入
    query TEXT NOT NULL DEFAULT '',
    knowledge_points JSONB NOT NULL DEFAULT '[]',
    resource_types JSONB NOT NULL DEFAULT '[]',
    subject_id VARCHAR(100),

    -- 任务状态
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    progress FLOAT NOT NULL DEFAULT 0.0,
    current_agent VARCHAR(50),
    error_message TEXT,

    -- 产出物摘要
    generated_types JSONB NOT NULL DEFAULT '[]',
    resource_ids JSONB NOT NULL DEFAULT '[]',
    path_id UUID,
    result_summary TEXT,
    state_snapshot JSONB,

    -- 时间
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP
);

CREATE INDEX idx_agent_tasks_user_id ON agent_tasks(user_id);
CREATE INDEX idx_agent_tasks_status ON agent_tasks(status);
CREATE INDEX idx_agent_tasks_created_at ON agent_tasks(created_at DESC);
