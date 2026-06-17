"""二叉树的链式存储与遍历

先序（根左右）、中序（左根右）、后序（左右根）、层次遍历（BFS）。
"""
from collections import deque

class TreeNode:
    def __init__(self, val=0):
        self.val = val; self.left = None; self.right = None

class BinaryTree:
    def __init__(self): self.root = None

    def build_from_list(self, vals: list):
        if not vals: return
        self.root = TreeNode(vals[0])
        queue = deque([self.root]); i = 1
        while queue and i < len(vals):
            node = queue.popleft()
            if vals[i] is not None:
                node.left = TreeNode(vals[i]); queue.append(node.left)
            i += 1
            if i < len(vals) and vals[i] is not None:
                node.right = TreeNode(vals[i]); queue.append(node.right)
            i += 1

    def preorder(self):
        res = []
        def _dfs(n):
            if not n: return
            res.append(n.val); _dfs(n.left); _dfs(n.right)
        _dfs(self.root); return res

    def inorder(self):
        res = []
        def _dfs(n):
            if not n: return
            _dfs(n.left); res.append(n.val); _dfs(n.right)
        _dfs(self.root); return res

    def postorder(self):
        res = []
        def _dfs(n):
            if not n: return
            _dfs(n.left); _dfs(n.right); res.append(n.val)
        _dfs(self.root); return res

    def levelorder(self):
        if not self.root: return []
        res = []; q = deque([self.root])
        while q:
            node = q.popleft(); res.append(node.val)
            if node.left: q.append(node.left)
            if node.right: q.append(node.right)
        return res

if __name__ == "__main__":
    print("二叉树遍历演示")
    tree = BinaryTree()
    tree.build_from_list([1, 2, 3, 4, 5, None, 6])
    print(f"先序(根左右): {tree.preorder()}")
    print(f"中序(左根右): {tree.inorder()}")
    print(f"后序(左右根): {tree.postorder()}")
    print(f"层次(BFS):    {tree.levelorder()}")
