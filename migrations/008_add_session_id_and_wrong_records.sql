-- 008: Add session_id to question_answers, create wrong_answer_records and daily_practice_records

-- 1) 向 question_answers 添加 session_id
ALTER TABLE question_answers ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES practice_sessions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_question_answers_session_id ON question_answers(session_id);

-- 2) 创建错题本表
CREATE TABLE IF NOT EXISTS wrong_answer_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    bank_id UUID NOT NULL REFERENCES question_banks(id) ON DELETE CASCADE,
    wrong_count INTEGER NOT NULL DEFAULT 1,
    first_wrong_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_wrong_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wrong_answer_uq ON wrong_answer_records(user_id, question_id);
CREATE INDEX IF NOT EXISTS idx_wrong_answer_user_bank ON wrong_answer_records(user_id, bank_id);
CREATE INDEX IF NOT EXISTS idx_wrong_answer_question ON wrong_answer_records(question_id);

-- 3) 创建每日练习统计表
CREATE TABLE IF NOT EXISTS daily_practice_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bank_id UUID NOT NULL REFERENCES question_banks(id) ON DELETE CASCADE,
    mode VARCHAR(20) NOT NULL DEFAULT 'random',
    record_date TIMESTAMP NOT NULL,
    total_questions INTEGER NOT NULL DEFAULT 0,
    correct_count INTEGER NOT NULL DEFAULT 0,
    incorrect_count INTEGER NOT NULL DEFAULT 0,
    total_time_spent_seconds INTEGER NOT NULL DEFAULT 0,
    session_count INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_record_uq ON daily_practice_records(user_id, bank_id, mode, record_date);
CREATE INDEX IF NOT EXISTS idx_daily_record_user_date ON daily_practice_records(user_id, record_date);
