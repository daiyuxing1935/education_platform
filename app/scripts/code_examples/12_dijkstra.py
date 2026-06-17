"""Dijkstra 最短路径算法（堆优化）

单源最短路径，要求边权非负。
贪心策略：每次选距离最小的顶点，更新其邻居。
时间复杂度 O(|E|log|V|)
"""
import heapq, math

def dijkstra(graph: list[list[tuple[int,int]]], start: int):
    n = len(graph); INF = math.inf
    dist = [INF]*n; prev = [-1]*n; visited = [False]*n
    dist[start] = 0; pq = [(0, start)]
    while pq:
        d, u = heapq.heappop(pq)
        if visited[u]: continue
        visited[u] = True
        for v, w in graph[u]:
            if not visited[v] and d + w < dist[v]:
                dist[v] = d + w; prev[v] = u
                heapq.heappush(pq, (dist[v], v))
    return dist, prev

def reconstruct_path(prev, target):
    path = []
    while target != -1: path.append(target); target = prev[target]
    return list(reversed(path))

if __name__ == "__main__":
    print("Dijkstra 最短路径")
    n = 6; graph = [[] for _ in range(n)]
    edges = [(0,1,2),(0,2,1),(1,3,3),(1,4,1),(2,4,3),(3,5,1),(4,5,1)]
    for u,v,w in edges: graph[u].append((v,w))
    names = ['A','B','C','D','E','F']
    dist, prev = dijkstra(graph, 0)
    for i in range(n):
        if dist[i] < math.inf:
            p = reconstruct_path(prev, i)
            print(f"->{names[i]}: 距离{dist[i]}, {'->'.join(names[v] for v in p)}")
        else:
            print(f"->{names[i]}: 不可达")
