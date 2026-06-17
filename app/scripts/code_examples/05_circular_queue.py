"""循环队列（Circular Queue）实现

队列是先进先出（FIFO）的线性表。循环队列利用取模运算实现循环。
队空: front == rear
队满: (rear+1) % capacity == front
"""
class CircularQueue:
    def __init__(self, capacity: int = 8):
        self._data = [None] * capacity
        self._front = 0; self._rear = 0
        self._capacity = capacity
    def is_empty(self): return self._front == self._rear
    def is_full(self): return (self._rear + 1) % self._capacity == self._front
    def size(self): return (self._rear - self._front + self._capacity) % self._capacity
    def enqueue(self, val):
        if self.is_full(): raise RuntimeError("队列已满")
        self._data[self._rear] = val
        self._rear = (self._rear + 1) % self._capacity
    def dequeue(self):
        if self.is_empty(): raise RuntimeError("队列为空")
        val = self._data[self._front]
        self._front = (self._front + 1) % self._capacity
        return val
    def peek(self):
        if self.is_empty(): raise RuntimeError("队列为空")
        return self._data[self._front]
    def display(self):
        items = []; i = self._front
        while i != self._rear:
            items.append(str(self._data[i]))
            i = (i + 1) % self._capacity
        print("队头 <- " + " <- ".join(items) + " <- 队尾" if items else "空队列")

if __name__ == "__main__":
    print("循环队列演示"); q = CircularQueue(6)
    for v in [10, 20, 30, 40, 50]: q.enqueue(v); print(f"入队 {v}:", end=" "); q.display()
    for _ in range(2): val = q.dequeue(); print(f"出队 {val}:", end=" "); q.display()
    q.enqueue(60); q.enqueue(70); print("入队60,70:", end=" "); q.display()
    print(f"队头:{q.peek()}, 长度:{q.size()}")
