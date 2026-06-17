"""双向链表（Doubly Linked List）实现

每个结点含前驱指针 prior 和后继指针 next，支持双向遍历。
"""
class DListNode:
    def __init__(self, val=0):
        self.val = val
        self.prior = None
        self.next = None

class DoublyLinkedList:
    def __init__(self):
        self.head = DListNode()
        self._size = 0
    def is_empty(self): return self._size == 0
    def length(self): return self._size
    def tail_insert(self, val):
        p = self.head
        while p.next: p = p.next
        node = DListNode(val)
        node.prior = p
        p.next = node
        self._size += 1
    def insert(self, index: int, val):
        if index < 0 or index > self._size: raise IndexError("插入位置非法")
        p = self.head
        for _ in range(index): p = p.next
        node = DListNode(val)
        node.next = p.next; node.prior = p
        if p.next: p.next.prior = node
        p.next = node; self._size += 1
    def delete(self, index: int):
        if index < 0 or index >= self._size: raise IndexError("删除位置非法")
        p = self.head.next
        for _ in range(index): p = p.next
        p.prior.next = p.next
        if p.next: p.next.prior = p.prior
        self._size -= 1; return p.val
    def display_forward(self):
        items = []; p = self.head.next
        while p: items.append(str(p.val)); p = p.next
        print(" -> ".join(items) if items else "空链表")
    def display_backward(self):
        items = []; p = self.head
        while p.next: p = p.next
        while p != self.head: items.append(str(p.val)); p = p.prior
        print(" <- ".join(items) if items else "空链表")

if __name__ == "__main__":
    print("双向链表演示"); dll = DoublyLinkedList()
    for v in [10, 20, 30, 40, 50]: dll.tail_insert(v)
    print("正向:", end=" "); dll.display_forward()
    print("反向:", end=" "); dll.display_backward()
    dll.insert(2, 25); print("插25:", end=" "); dll.display_forward()
    d = dll.delete(3); print(f"删{d}:", end=" "); dll.display_forward()
