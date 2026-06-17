"""深度优先搜索（DFS）

使用栈（递归/显式）实现回溯遍历。
时间复杂度 O(|V|+|E|)
"""
class Graph:
    def __init__(self, n: int):
        self._n = n; self._adj = [[] for _ in range(n)]
        self._names = [str(i) for i in range(n)]
    def set_name(self, i, n): self._names[i] = n
    def add_edge(self, u, v): self._adj[u].append(v); self._adj[v].append(u)
    def get_name(self, i): return self._names[i]

def dfs_recursive(g: Graph, start: int) -> list[int]:
    visited = set(); order = []
    def _dfs(u):
        visited.add(u); order.append(u)
        for v in g._adj[u]:
            if v not in visited: _dfs(v)
    _dfs(start); return order

def dfs_iterative(g: Graph, start: int) -> list[int]:
    visited = set(); stack = [start]; order = []
    while stack:
        u = stack.pop()
        if u not in visited:
            visited.add(u); order.append(u)
            for v in reversed(g._adj[u]):
                if v not in visited: stack.append(v)
    return order

def find_path(g: Graph, start: int, end: int):
    parent = {start: None}; stack = [start]; visited = set()
    while stack:
        u = stack.pop()
        if u == end:
            path = []
            while u is not None: path.append(u); u = parent[u]
            return list(reversed(path))
        if u not in visited:
            visited.add(u)
            for v in g._adj[u]:
                if v not in visited and v not in parent:
                    parent[v] = u; stack.append(v)
    return None

if __name__ == "__main__":
    print("DFS 深度优先搜索")
    g = Graph(6)
    for i, n in enumerate(['A','B','C','D','E','F']): g.set_name(i, n)
    for u,v in [(0,1),(0,2),(1,3),(1,4),(2,4),(3,5),(4,5)]: g.add_edge(u,v)
    print(f"DFS递归:   {[g.get_name(i) for i in dfs_recursive(g,0)]}")
    print(f"DFS非递归: {[g.get_name(i) for i in dfs_iterative(g,0)]}")
    p = find_path(g, 0, 5)
    if p: print(f"找路径:    {' -> '.join(g.get_name(i) for i in p)}")
