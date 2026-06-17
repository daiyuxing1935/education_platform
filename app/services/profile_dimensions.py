"""动态画像维度计算 — 随每个学习事件重新计算

三个核心维度:

1. 元认知校准 (Metacognitive Calibration)
   自评与实测的偏差计算与趋势更新
   公式: calibration = 1 - |self_assessed_score - actual_score|
   阈值: < 0.3 → 校准预警, > 0.7 → 校准良好

2. 注意力特征 (Attention Feature)
   代理指标(停留、交互、跳转)的时序分数
   公式: attention = dwell_score * 0.4 + interaction_score * 0.35 + navigation_score * 0.25
   阈值: < 0.3 → 注意力低迷, > 0.7 → 注意力集中

3. 学习节奏 (Learning Rhythm)
   单元耗时与间隔的动态偏好区间
   公式: pace = 1 - |unit_time - preferred_unit| / max(unit_time, preferred_unit)
   阈值: < 0.3 → 节奏失调, > 0.7 → 节奏良好

相互影响:
- 注意力低迷 → 校准偏差增大(自评不准)
- 节奏失调 → 注意力下降
- 校准良好 → 节奏偏好更准确
"""

import logging
from typing import Optional, Dict, Any
from datetime import datetime

logger = logging.getLogger(__name__)

# ─── 阈值常量 ───
CALIBRATION_LOW = 0.3       # 校准预警阈值
CALIBRATION_HIGH = 0.7      # 校准良好阈值
ATTENTION_LOW = 0.3         # 注意力低迷阈值
ATTENTION_HIGH = 0.7        # 注意力集中阈值
RHYTHM_LOW = 0.3            # 节奏失调阈值
RHYTHM_HIGH = 0.7           # 节奏良好阈值

# EMA 平滑系数
EMA_ALPHA = 0.3

# 预期参数
EXPECTED_DWELL_SECONDS = 30      # 预期停留时间(秒)
EXPECTED_UNIT_TIME_SECONDS = 120  # 预期单元完成时间(秒)
EXPECTED_INTERACTION_COUNT = 3    # 预期交互次数


def calculate_metacognitive_calibration(
    self_assessed_score: float,  # 自评分数 0-1
    actual_score: float,         # 实测分数 0-1
    previous_calibration: float = 0.5,
    attention_feature: float = 0.5,
) -> dict:
    """计算元认知校准

    calibration = 1 - |self_assessed - actual|

    注意力影响: 注意力低迷时,校准偏差增大
    返回: {value, deviation, trend, alert}
    """
    deviation = abs(self_assessed_score - actual_score)
    raw_calibration = 1.0 - deviation

    # 注意力影响: 注意力越低,校准越差(偏差放大)
    attention_penalty = max(0, (0.5 - attention_feature)) * 0.3
    calibrated = raw_calibration - attention_penalty

    # EMA 平滑
    value = previous_calibration * (1 - EMA_ALPHA) + calibrated * EMA_ALPHA
    value = max(0.0, min(1.0, value))

    # 趋势: 与上一次比较
    trend = value - previous_calibration

    alert = None
    if value < CALIBRATION_LOW:
        alert = "校准预警: 自评与实测偏差过大，建议暂停反思"
    elif value > CALIBRATION_HIGH:
        alert = "校准良好: 自我认知准确，继续保持"

    return {
        "value": round(value, 3),
        "deviation": round(deviation, 3),
        "trend": round(trend, 3),
        "alert": alert,
    }


def calculate_attention_feature(
    dwell_time_seconds: int,        # 停留时间(秒)
    interaction_count: int,          # 交互次数
    navigation_jumps: int,           # 跳转次数
    task_duration_seconds: int,      # 任务总持续时间(秒)
    previous_attention: float = 0.5,
    learning_rhythm: float = 0.5,
) -> dict:
    """计算注意力特征(代理指标时序分数)

    dwell_score: 停留时间与预期的匹配度
    interaction_score: 交互频率的适度性
    navigation_score: 跳转行为的集中度

    学习节奏影响: 节奏良好时注意力更稳定
    """
    # 停留分数: 过短(<5s)或过长(>300s)都表示注意力问题
    if dwell_time_seconds < 5:
        dwell_score = 0.1  # 跳过快,可能未认真
    elif dwell_time_seconds > 300:
        dwell_score = 0.3  # 过长,可能卡住或分心
    else:
        dwell_score = 1.0 - abs(dwell_time_seconds - EXPECTED_DWELL_SECONDS) / max(EXPECTED_DWELL_SECONDS, dwell_time_seconds)

    # 交互分数: 适度交互表示投入
    if interaction_count == 0:
        interaction_score = 0.1  # 无交互,可能未参与
    elif interaction_count <= 1:
        interaction_score = 0.3
    elif interaction_count <= EXPECTED_INTERACTION_COUNT * 2:
        interaction_score = min(1.0, interaction_count / EXPECTED_INTERACTION_COUNT * 0.5)
    else:
        interaction_score = 0.5  # 过度交互可能表示困惑

    # 导航分数: 频繁跳转表示注意力分散
    if navigation_jumps == 0:
        nav_score = 1.0  # 无跳转,专注
    elif navigation_jumps <= 2:
        nav_score = 0.8
    elif navigation_jumps <= 5:
        nav_score = 0.5
    else:
        nav_score = 0.2  # 频繁跳转,注意力分散

    # 综合计算
    raw_attention = dwell_score * 0.4 + interaction_score * 0.35 + nav_score * 0.25

    # 节奏影响: 节奏良好(+0.1),节奏失调(-0.1)
    rhythm_bonus = 0.0
    if learning_rhythm > RHYTHM_HIGH:
        rhythm_bonus = 0.1
    elif learning_rhythm < RHYTHM_LOW:
        rhythm_bonus = -0.1

    calibrated = raw_attention + rhythm_bonus

    # EMA 平滑
    value = previous_attention * (1 - EMA_ALPHA) + calibrated * EMA_ALPHA
    value = max(0.0, min(1.0, value))

    trend = value - previous_attention

    alert = None
    if value < ATTENTION_LOW:
        alert = "注意力低迷: 建议休息5分钟或切换学习方式"
    elif value > ATTENTION_HIGH:
        alert = "注意力集中: 当前状态良好，适合攻克难点"

    return {
        "value": round(value, 3),
        "dwell_score": round(dwell_score, 3),
        "interaction_score": round(interaction_score, 3),
        "navigation_score": round(nav_score, 3),
        "trend": round(trend, 3),
        "alert": alert,
    }


def calculate_learning_rhythm(
    unit_time_seconds: int,         # 本次单元完成耗时(秒)
    rest_interval_seconds: int,      # 距上次学习间隔(秒)
    previous_rhythm: dict = None,    # {scalar, trend, preferred_unit, preferred_rest}
    metacognitive_calibration: float = 0.5,
) -> dict:
    """计算学习节奏(动态偏好区间)

    unit_score: 单元耗时与偏好的匹配度
    rest_score: 休息间隔的规律性

    元认知影响: 校准良好时,节奏偏好更准确
    """
    if previous_rhythm is None:
        previous_rhythm = {
            "scalar": 0.5,
            "trend": 0.0,
            "preferred_unit": EXPECTED_UNIT_TIME_SECONDS,
            "preferred_rest": 300,  # 5分钟
        }

    preferred_unit = previous_rhythm.get("preferred_unit", EXPECTED_UNIT_TIME_SECONDS)
    preferred_rest = previous_rhythm.get("preferred_rest", 300)

    # 单元耗时匹配度
    unit_diff = abs(unit_time_seconds - preferred_unit) / max(unit_time_seconds, preferred_unit, 1)
    unit_score = max(0, 1.0 - unit_diff)

    # 休息间隔匹配度
    rest_diff = abs(rest_interval_seconds - preferred_rest) / max(rest_interval_seconds, preferred_rest, 1)
    rest_score = max(0, 1.0 - rest_diff)

    # 综合节奏分数
    raw_rhythm = unit_score * 0.6 + rest_score * 0.4

    # 元认知影响: 校准良好 → 节奏偏好更新更准确
    cal_bonus = max(0, metacognitive_calibration - 0.5) * 0.2
    calibrated = raw_rhythm + cal_bonus

    # EMA 平滑
    scalar = previous_rhythm.get("scalar", 0.5)
    value = scalar * (1 - EMA_ALPHA) + calibrated * EMA_ALPHA
    value = max(0.0, min(1.0, value))

    trend = value - scalar

    # 动态更新偏好(自适应)
    new_preferred_unit = int(preferred_unit * 0.8 + unit_time_seconds * 0.2)
    new_preferred_rest = int(preferred_rest * 0.8 + rest_interval_seconds * 0.2)
    # 限制范围
    new_preferred_unit = max(30, min(600, new_preferred_unit))
    new_preferred_rest = max(60, min(3600, new_preferred_rest))

    alert = None
    if value < RHYTHM_LOW:
        alert = "节奏失调: 建议调整学习单元大小或休息间隔"
    elif value > RHYTHM_HIGH:
        alert = "节奏良好: 当前学习节奏适合你"

    return {
        "scalar": round(value, 3),
        "trend": round(trend, 3),
        "unit_score": round(unit_score, 3),
        "rest_score": round(rest_score, 3),
        "preferred_unit": new_preferred_unit,
        "preferred_rest": new_preferred_rest,
        "alert": alert,
    }


def update_all_dimensions(
    current_dimensions: Dict[str, Any],
    event_data: Dict[str, Any],
) -> Dict[str, Any]:
    """随每个学习事件更新所有三个维度

    Args:
        current_dimensions: 当前维度值
            {metacognitive_calibration, attention_feature, learning_rhythm:{scalar,trend,...}}
        event_data: 当前事件数据
            {self_assessed_score, actual_score, dwell_time, interaction_count,
             navigation_jumps, task_duration, unit_time, rest_interval}

    Returns:
        更新后的维度值 + alerts
    """
    dims = current_dimensions.copy()

    # 获取当前值
    prev_cal = dims.get("metacognitive_calibration", 0.5)
    prev_attn = dims.get("attention_feature", 0.5)
    prev_rhythm = dims.get("learning_rhythm", {"scalar": 0.5, "trend": 0.0})

    # 1. 注意力特征
    attn_result = calculate_attention_feature(
        dwell_time_seconds=event_data.get("dwell_time", 30),
        interaction_count=event_data.get("interaction_count", 0),
        navigation_jumps=event_data.get("navigation_jumps", 0),
        task_duration_seconds=event_data.get("task_duration", 60),
        previous_attention=prev_attn if isinstance(prev_attn, (int, float)) else 0.5,
        learning_rhythm=prev_rhythm.get("scalar", 0.5) if isinstance(prev_rhythm, dict) else 0.5,
    )

    # 2. 元认知校准
    cal_result = calculate_metacognitive_calibration(
        self_assessed_score=event_data.get("self_assessed_score", 0.5),
        actual_score=event_data.get("actual_score", 0.5),
        previous_calibration=prev_cal if isinstance(prev_cal, (int, float)) else 0.5,
        attention_feature=attn_result["value"],
    )

    # 3. 学习节奏
    rhythm_result = calculate_learning_rhythm(
        unit_time_seconds=event_data.get("unit_time", 120),
        rest_interval_seconds=event_data.get("rest_interval", 300),
        previous_rhythm=prev_rhythm if isinstance(prev_rhythm, dict) else None,
        metacognitive_calibration=cal_result["value"],
    )

    # 更新维度
    dims["metacognitive_calibration"] = cal_result["value"]
    dims["attention_feature"] = attn_result["value"]
    dims["learning_rhythm"] = {
        "scalar": rhythm_result["scalar"],
        "trend": rhythm_result["trend"],
        "preferred_unit": rhythm_result["preferred_unit"],
        "preferred_rest": rhythm_result["preferred_rest"],
    }

    # 收集告警
    alerts = []
    for result in [cal_result, attn_result, rhythm_result]:
        if result.get("alert"):
            alerts.append(result["alert"])

    dims["_alerts"] = alerts

    return dims
