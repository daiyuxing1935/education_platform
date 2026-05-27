import os
import sys
import subprocess
import tempfile
import time
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.dependencies import get_current_user, CurrentUser

router = APIRouter(prefix="/code", tags=["code"])

EXECUTION_TIMEOUT = 30  # seconds


class CodeExecuteRequest(BaseModel):
    language: str  # python, javascript, java, c, cpp
    code: str


class CodeExecuteResponse(BaseModel):
    stdout: str
    stderr: str
    exit_code: int
    execution_time: float


def _write_temp_file(suffix: str) -> tuple[str, str]:
    """Create a temp file and return (file_path, dir_path)."""
    tmp_dir = tempfile.mkdtemp(prefix="code_exec_")
    file_path = os.path.join(tmp_dir, f"Main{suffix}")
    return file_path, tmp_dir


def _cleanup(dir_path: str):
    """Remove temp directory and its contents."""
    import shutil
    try:
        shutil.rmtree(dir_path, ignore_errors=True)
    except Exception:
        pass


def _execute(cmd: list[str], cwd: str) -> tuple[str, str, int, float]:
    """Execute a command and return (stdout, stderr, exit_code, execution_time)."""
    start = time.time()
    try:
        result = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=EXECUTION_TIMEOUT,
        )
        execution_time = time.time() - start
        return result.stdout, result.stderr, result.returncode, execution_time
    except subprocess.TimeoutExpired:
        execution_time = time.time() - start
        return "", f"执行超时（超过 {EXECUTION_TIMEOUT} 秒）", -1, execution_time
    except FileNotFoundError as e:
        return "", f"找不到编译器/解释器: {e}", -2, 0
    except Exception as e:
        return "", f"执行出错: {str(e)}", -3, 0


def _execute_python(code: str) -> CodeExecuteResponse:
    file_path, tmp_dir = _write_temp_file(".py")
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(code)
        python_exe = getattr(sys, 'executable', 'python3')
        stdout, stderr, exit_code, exec_time = _execute([python_exe, file_path], tmp_dir)
        return CodeExecuteResponse(stdout=stdout, stderr=stderr, exit_code=exit_code, execution_time=round(exec_time, 3))
    finally:
        _cleanup(tmp_dir)


def _execute_javascript(code: str) -> CodeExecuteResponse:
    file_path, tmp_dir = _write_temp_file(".js")
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(code)
        stdout, stderr, exit_code, exec_time = _execute(["node", file_path], tmp_dir)
        return CodeExecuteResponse(stdout=stdout, stderr=stderr, exit_code=exit_code, execution_time=round(exec_time, 3))
    finally:
        _cleanup(tmp_dir)


def _execute_java(code: str) -> CodeExecuteResponse:
    # Java needs the file name to match the class name
    # Try to extract class name from code
    import re
    class_match = re.search(r'(?:public\s+)?(?:class|interface)\s+(\w+)', code)
    class_name = class_match.group(1) if class_match else "Main"

    file_path, tmp_dir = _write_temp_file(f".java")
    file_path = os.path.join(tmp_dir, f"{class_name}.java")
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(code)
        # Compile
        _, compile_stderr, compile_code, compile_time = _execute(["javac", file_path], tmp_dir)
        if compile_code != 0:
            return CodeExecuteResponse(stdout="", stderr=f"编译错误:\n{compile_stderr}", exit_code=compile_code, execution_time=round(compile_time, 3))
        # Run
        stdout, stderr, exit_code, exec_time = _execute(["java", "-cp", tmp_dir, class_name], tmp_dir)
        return CodeExecuteResponse(stdout=stdout, stderr=stderr, exit_code=exit_code, execution_time=round(exec_time, 3))
    finally:
        _cleanup(tmp_dir)


def _execute_c(code: str) -> CodeExecuteResponse:
    file_path, tmp_dir = _write_temp_file(".c")
    binary_path = os.path.join(tmp_dir, "Main")
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(code)
        # Compile
        _, compile_stderr, compile_code, compile_time = _execute(["gcc", file_path, "-o", binary_path], tmp_dir)
        if compile_code != 0:
            return CodeExecuteResponse(stdout="", stderr=f"编译错误:\n{compile_stderr}", exit_code=compile_code, execution_time=round(compile_time, 3))
        # Run
        stdout, stderr, exit_code, exec_time = _execute([binary_path], tmp_dir)
        return CodeExecuteResponse(stdout=stdout, stderr=stderr, exit_code=exit_code, execution_time=round(exec_time, 3))
    finally:
        _cleanup(tmp_dir)


def _execute_cpp(code: str) -> CodeExecuteResponse:
    file_path, tmp_dir = _write_temp_file(".cpp")
    binary_path = os.path.join(tmp_dir, "Main")
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(code)
        # Compile
        _, compile_stderr, compile_code, compile_time = _execute(["g++", file_path, "-o", binary_path], tmp_dir)
        if compile_code != 0:
            return CodeExecuteResponse(stdout="", stderr=f"编译错误:\n{compile_stderr}", exit_code=compile_code, execution_time=round(compile_time, 3))
        # Run
        stdout, stderr, exit_code, exec_time = _execute([binary_path], tmp_dir)
        return CodeExecuteResponse(stdout=stdout, stderr=stderr, exit_code=exit_code, execution_time=round(exec_time, 3))
    finally:
        _cleanup(tmp_dir)


LANGUAGE_EXECUTORS = {
    "python": _execute_python,
    "javascript": _execute_javascript,
    "java": _execute_java,
    "c": _execute_c,
    "cpp": _execute_cpp,
}


@router.post("/execute", response_model=CodeExecuteResponse)
async def execute_code(
    request: CodeExecuteRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    if not request.code.strip():
        raise HTTPException(status_code=400, detail="代码不能为空")
    if request.language not in LANGUAGE_EXECUTORS:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的语言: {request.language}。支持的语言: {', '.join(LANGUAGE_EXECUTORS.keys())}"
        )

    executor = LANGUAGE_EXECUTORS[request.language]
    return executor(request.code)
