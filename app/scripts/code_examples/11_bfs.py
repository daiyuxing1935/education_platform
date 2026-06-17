"""广度优先搜索（BFS）

使用队列实现层次遍历，可求无权图的最短路径。
时间复杂度 O(|V|+|E|)
"""
from collections import deque

class Graph:
    def __init__(self, n: int):
        self._n = n; self._adj = [[] for _ in range(n)]
        self._names = [str(i) for i in range(n)]
    def set_name(self, i, n): self._names[i] = n
    def add_edge(self, u, v): self._adj[u].append(v); self._adj[v].append(u)
    def get_name(self, i): return self._names[i]

def bfs(g: Graph, start: int) -> list[int]:
    visited = {start}; q = deque([start]); order = []
    while q:
        u = q.popleft(); order.append(u)
        for v in g._adj[u]:
            if v not in visited: visited.add(v); q.append(v)
    return order

def bfs_shortest_path(g: Graph, start: int, end: int):
    visited = {start}; parent = {start: None}; q = deque([start])
    while q:
        u = q.popleft()
        if u == end:
            path = []
            while u is not None: path.append(u); u = parent[u]
            return list(reversed(path))
        for v in g._adj[u]:
            if v not in visited: visited.add(v); parent[v] = u; q.append(v)
    return None

def bfs_distances(g: Graph, start: int) -> dict:
    dist = {start: 0}; q = deque([start])
    while q:
        u = q.popleft()
        for v in g._adj[u]:
            if v not in dist: dist[v] = dist[u] + 1; q.append(v)
    return dist

if __name__ == "__main__":
    print("BFS 广度优先搜索")
    g = Graph(6)
    for i, n in enumerate(['A','B','C','D','E','F']): g.set_name(i, n)
    for u,v in [(0,1),(0,2),(1,3),(1,4),(2,4),(3,5),(4,5)]: g.add_edge(u,v)
    print(f"BFS遍历:    {[g.get_name(i) for i in bfs(g,0)]}")
    p = bfs_shortest_path(g, 0, 5)
    if p: print(f"最短路径:   {' -> '.join(g.get_name(i) for i in p)}")
    for v,d in sorted(bfs_distances(g,0).items()):
        print(f"  {g.get_name(v)}: {d}步")
