"""哈夫曼树与哈夫曼编码

哈夫曼树是最优二叉树，WPL 最小。用于数据压缩的前缀编码。
"""
import heapq

class HuffmanNode:
    def __init__(self, char=None, freq=0):
        self.char = char; self.freq = freq
        self.left = None; self.right = None
    def __lt__(self, other): return self.freq < other.freq

def build_huffman_tree(freq: dict) -> HuffmanNode:
    heap = []
    for char, f in freq.items():
        heapq.heappush(heap, HuffmanNode(char, f))
    while len(heap) > 1:
        left = heapq.heappop(heap); right = heapq.heappop(heap)
        parent = HuffmanNode(freq=left.freq + right.freq)
        parent.left = left; parent.right = right
        heapq.heappush(heap, parent)
    return heap[0]

def build_code_table(node, prefix="", table=None):
    if table is None: table = {}
    if node.char is not None:
        table[node.char] = prefix or "0"
    else:
        if node.left: build_code_table(node.left, prefix + "0", table)
        if node.right: build_code_table(node.right, prefix + "1", table)
    return table

def encode(text: str, table: dict) -> str:
    return ''.join(table[ch] for ch in text)

def decode(encoded: str, root: HuffmanNode) -> str:
    result = []; node = root
    for bit in encoded:
        node = node.left if bit == '0' else node.right
        if node.char is not None:
            result.append(node.char); node = root
    return ''.join(result)

def calc_wpl(node, depth=0) -> int:
    if node is None: return 0
    if node.left is None and node.right is None:
        return node.freq * depth
    return calc_wpl(node.left, depth+1) + calc_wpl(node.right, depth+1)

if __name__ == "__main__":
    print("哈夫曼树演示")
    freq = {'A': 5, 'B': 4, 'C': 3, 'D': 2, 'E': 1}
    root = build_huffman_tree(freq)
    print(f"WPL = {calc_wpl(root)}")
    table = build_code_table(root)
    for ch, code in sorted(table.items(), key=lambda x: x[1]):
        print(f"  '{ch}': {code}")
    original = "ABCDE"
    bits = encode(original, table)
    decoded = decode(bits, root)
    print(f"\n编码: {original} -> {bits}")
    print(f"解码: -> {decoded}")
    ratio = (1 - len(bits) / (len(original) * 8)) * 100
    print(f"压缩率: {ratio:.1f}%")
