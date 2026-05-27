import os
from pathlib import Path

# 要排除的目录和文件
EXCLUDE_DIRS = {
    'node_modules', '.git', '__pycache__', 'venv', '.venv',
    'migrations',  # Django 迁移文件自动生成
    '.next', 'dist', 'build', 'target',
}
EXCLUDE_EXTS = {
    '.pyc', '.pyo', '.so', '.dll', '.dylib',
    '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg',
    '.woff', '.woff2', '.ttf', '.eot',
    '.mp4', '.avi', '.mov',
    '.zip', '.tar', '.gz',
    '.lock',
}
INCLUDE_EXTS = {
    '.py', '.js', '.jsx', '.ts', '.tsx',
    '.css', '.scss', '.less',
    '.html', '.htm',
    '.json', '.yaml', '.yml', '.toml', '.ini', '.cfg',
    '.md', '.mdx', '.rst',
    '.sql',
    '.sh', '.bat', '.ps1',
    '.env', '.env.example',
    '.dockerfile', 'Dockerfile',
    '.yml', '.yaml',
    '.conf',
}


def count_lines(root: Path) -> dict:
    total = 0
    file_count = 0
    by_ext = {}

    for dirpath, dirnames, filenames in os.walk(root):
        # 跳过排除目录（原地修改 dirnames 避免 os.walk 进入）
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]

        for f in filenames:
            ext = Path(f).suffix.lower()
            if ext in EXCLUDE_EXTS:
                continue

            # Dockerfile 没有扩展名
            if ext not in INCLUDE_EXTS and f != 'Dockerfile':
                continue

            fp = Path(dirpath) / f
            try:
                with open(fp, 'r', encoding='utf-8', errors='ignore') as fh:
                    lines = sum(1 for _ in fh)
            except Exception:
                continue

            total += lines
            file_count += 1
            by_ext[ext] = by_ext.get(ext, 0) + lines

    return {'total': total, 'files': file_count, 'by_ext': dict(sorted(by_ext.items()))}


if __name__ == '__main__':
    root = Path(__file__).resolve().parent
    result = count_lines(root)

    print(f'项目: {root}')
    print(f'有效文件数: {result["files"]}')
    print(f'总代码行数: {result["total"]}')
    print()
    print('按扩展名统计:')
    for ext, lines in result['by_ext'].items():
        print(f'  {ext or "(无扩展名)"}: {lines} 行')
