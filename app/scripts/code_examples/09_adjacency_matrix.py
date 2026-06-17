"""图的邻接矩阵存储

用 n×n 矩阵表示顶点间的邻接关系。无向图的矩阵对称。
"""
class GraphMatrix:
    def __init__(self, vertex_count: int, directed=False):
        self._n = vertex_count
        self._directed = directed
        self._matrix = [[0]*vertex_count for _ in range(vertex_count)]
        self._names = [str(i) for i in range(vertex_count)]

    def set_name(self, index: int, name: str): self._names[index] = name

    def add_edge(self, u: int, v: int, weight: int = 1):
        self._matrix[u][v] = weight
        if not self._directed: self._matrix[v][u] = weight

    def has_edge(self, u: int, v: int) -> bool:
        return self._matrix[u][v] != 0

    def neighbors(self, u: int) -> list[int]:
        return [v for v in range(self._n) if self._matrix[u][v] != 0]

    def display(self):
        print(f"{'有向' if self._directed else '无向'}图 ({self._n}顶点)")
        print("    ", end="")
        for i in range(self._n): print(f"{self._names[i]:>3}", end=" ")
        print()
        for i in range(self._n):
            print(f"{self._names[i]:>3} ", end=" ")
            for j in range(self._n): print(f"{self._matrix[i][j]:>3}", end=" ")
            print()

if __name__ == "__main__":
    print("邻接矩阵演示")
    g = GraphMatrix(5)
    for i, n in enumerate(['A','B','C','D','E']): g.set_name(i, n)
    for u,v in [(0,1),(0,2),(1,2),(1,3),(2,4)]: g.add_edge(u,v)
    g.display()
    print(f"B的邻居:{[g._names[v] for v in g.neighbors(1)]}")
    print(f"A-C有边:{g.has_edge(0,2)}, A-D有边:{g.has_edge(0,3)}")
