"""顺序栈（Sequential Stack）实现

栈是后进先出（LIFO）的线性表，限定仅在栈顶进行插入和删除。
"""
class SeqStack:
    def __init__(self, capacity: int = 10):
        self._data = [None] * capacity
        self._top = -1
        self._capacity = capacity
    def is_empty(self): return self._top == -1
    def is_full(self): return self._top == self._capacity - 1
    def size(self): return self._top + 1
    def push(self, val):
        if self.is_full(): raise RuntimeError("栈满")
        self._top += 1; self._data[self._top] = val
    def pop(self):
        if self.is_empty(): raise RuntimeError("栈空")
        val = self._data[self._top]; self._top -= 1; return val
    def peek(self):
        if self.is_empty(): raise RuntimeError("栈空")
        return self._data[self._top]
    def display(self):
        items = [str(self._data[i]) for i in range(self._top + 1)]
        print("栈底 -> " + " | ".join(items) + " -> 栈顶")

if __name__ == "__main__":
    print("顺序栈演示"); st = SeqStack(6)
    for v in [10, 20, 30, 40, 50]:
        st.push(v); print(f"入栈 {v}:", end=" "); st.display()
    print(f"栈顶:{st.peek()}, 大小:{st.size()}")
    for _ in range(3):
        val = st.pop(); print(f"出栈 {val}:", end=" "); st.display()
    print("\n[闪电] LIFO | 所有操作 O(1)")
