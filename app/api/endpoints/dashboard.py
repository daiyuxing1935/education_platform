from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.dependencies import CurrentUser, get_current_user
from app.db.database import get_db
from app.models.question_bank import StudentAnswer

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


class StudyStatsResponse(BaseModel):
    total_study_days: int
    current_streak: int
    longest_streak: int
    today_questions: int
    today_minutes: int


@router.get("/stats", response_model=StudyStatsResponse)
async def get_study_stats(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    计算用户学习天数统计：
    - total_study_days: 总学习天数（有答题记录的日期数）
    - current_streak: 当前连续学习天数
    - longest_streak: 最长连续学习天数
    - today_questions: 今日完成题目数
    - today_minutes: 今日学习分钟数
    """
    user_id = current_user.student_id

    # 查询所有有答题记录的日期（按用户去重到天）
    rows = (
        db.query(
            func.date(StudentAnswer.created_at).label("study_date"),
            func.count(StudentAnswer.id).label("q_count"),
            func.coalesce(func.sum(StudentAnswer.time_spent_seconds), 0).label("total_seconds"),
        )
        .filter(StudentAnswer.user_id == user_id)
        .group_by(func.date(StudentAnswer.created_at))
        .order_by(func.date(StudentAnswer.created_at).desc())
        .all()
    )

    study_dates: list[date] = [row.study_date for row in rows]

    # 今日统计
    today = date.today()
    today_qs = 0
    today_mins = 0
    for row in rows:
        if row.study_date == today:
            today_qs = row.q_count
            today_mins = row.total_seconds // 60
            break

    total_study_days = len(study_dates)

    # 计算当前连续学习天数
    current_streak = 0
    if study_dates:
        check = today
        for d in study_dates:
            if d == check:
                current_streak += 1
                check -= timedelta(days=1)
            elif d < check:
                # 如果最大的学习日期小于今天，从最大日期开始算
                break

    # 如果今天没有学习但昨天有学习，从昨天开始算
    if current_streak == 0 and study_dates:
        check = today - timedelta(days=1)
        temp_streak = 0
        for d in study_dates:
            if d == check:
                temp_streak += 1
                check -= timedelta(days=1)
            elif d < check:
                break
        current_streak = temp_streak

    # 计算最长连续学习天数
    longest_streak = 0
    if study_dates:
        sorted_dates = sorted(study_dates)
        streak = 1
        longest_streak = 1
        for i in range(1, len(sorted_dates)):
            if (sorted_dates[i] - sorted_dates[i - 1]).days == 1:
                streak += 1
                longest_streak = max(longest_streak, streak)
            else:
                streak = 1

    # 新用户第一天至少显示1天
    if total_study_days == 0:
        total_study_days = 1
    if current_streak == 0:
        current_streak = 1
    if longest_streak == 0:
        longest_streak = 1

    return StudyStatsResponse(
        total_study_days=total_study_days,
        current_streak=current_streak,
        longest_streak=longest_streak,
        today_questions=today_qs,
        today_minutes=today_mins,
    )
