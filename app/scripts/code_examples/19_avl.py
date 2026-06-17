"""平衡二叉树（AVL）

|平衡因子| <= 1，通过旋转保持平衡。
四种旋转：LL(右旋)、RR(左旋)、LR(左右)、RL(右左)
"""

class AVLNode:
    def __init__(self, val=0):
        self.val = val; self.left = None; self.right = None; self.height = 1

class AVL:
    def __init__(self): self.root = None

    def _h(self, n): return n.height if n else 0
    def _bf(self, n): return self._h(n.left) - self._h(n.right)
    def _upd_h(self, n): n.height = 1 + max(self._h(n.left), self._h(n.right))

    def _rr(self, y):
        x = y.left; t2 = x.right; x.right = y; y.left = t2
        self._upd_h(y); self._upd_h(x); return x

    def _ll(self, x):
        y = x.right; t2 = y.left; y.left = x; x.right = t2
        self._upd_h(x); self._upd_h(y); return y

    def _balance(self, n):
        bf = self._bf(n)
        if bf > 1 and self._bf(n.left) >= 0: return self._rr(n)
        if bf > 1 and self._bf(n.left) < 0:
            n.left = self._ll(n.left); return self._rr(n)
        if bf < -1 and self._bf(n.right) <= 0: return self._ll(n)
        if bf < -1 and self._bf(n.right) > 0:
            n.right = self._rr(n.right); return self._ll(n)
        return n

    def insert(self, val): self.root = self._ins(self.root, val)
    def _ins(self, n, val):
        if not n: return AVLNode(val)
        if val < n.val: n.left = self._ins(n.left, val)
        elif val > n.val: n.right = self._ins(n.right, val)
        else: return n
        self._upd_h(n); return self._balance(n)

    def inorder(self) -> list:
        res = []
        def _dfs(n):
            if not n: return
            _dfs(n.left); res.append(n.val); _dfs(n.right)
        _dfs(self.root); return res

if __name__ == "__main__":
    print("AVL 平衡二叉树演示")
    avl = AVL()
    for v in [10, 20, 30, 40, 50, 25]: avl.insert(v)
    print(f"中序遍历: {avl.inorder()} ← 升序")
    print(f"树高: {avl._h(avl.root)}")
    print(f"[闪电] O(log n) 查找/插入 | 四种旋转保持平衡")
