"""二叉排序树（BST）

左子树所有值 < 根 < 右子树所有值。
中序遍历得递增序列。
"""

class BSTNode:
    def __init__(self, val=0):
        self.val = val; self.left = None; self.right = None

class BST:
    def __init__(self): self.root = None

    def search(self, val):
        node = self.root
        while node:
            if val == node.val: return node
            elif val < node.val: node = node.left
            else: node = node.right
        return None

    def insert(self, val):
        if self.root is None: self.root = BSTNode(val); return
        node = self.root
        while True:
            if val < node.val:
                if node.left is None: node.left = BSTNode(val); return
                node = node.left
            else:
                if node.right is None: node.right = BSTNode(val); return
                node = node.right

    def delete(self, val) -> bool:
        parent, node = None, self.root
        while node and node.val != val:
            parent = node
            if val < node.val: node = node.left
            else: node = node.right
        if node is None: return False
        if node.left and node.right:
            succ = node.right; succ_p = node
            while succ.left: succ_p = succ; succ = succ.left
            node.val = succ.val; node, parent = succ, succ_p
        child = node.left if node.left else node.right
        if parent is None: self.root = child
        elif parent.left == node: parent.left = child
        else: parent.right = child
        return True

    def inorder(self) -> list:
        res = []
        def _dfs(n):
            if not n: return
            _dfs(n.left); res.append(n.val); _dfs(n.right)
        _dfs(self.root); return res

if __name__ == "__main__":
    print("二叉排序树演示")
    bst = BST()
    values = [50, 30, 80, 20, 40, 70, 90, 35]
    for v in values: bst.insert(v)
    print(f"中序遍历: {bst.inorder()} ← 升序")
    print(f"查找40: {'找到' if bst.search(40) else '未找到'}")
    for d in [20, 30, 50]: bst.delete(d); print(f"删{d}: {bst.inorder()}")
