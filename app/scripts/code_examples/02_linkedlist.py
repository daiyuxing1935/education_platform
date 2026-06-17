"""单链表（Singly Linked List）实现

单链表通过指针将结点链接在一起，每个结点包含数据域和指针域。
支持：头插法、尾插法、按位查找、按值查找、插入、删除。
"""

class ListNode:
    """单链表结点"""
    def __init__(self, val=0, next_node=None):
        self.val = val
        self.next = next_node


class LinkedList:
    """单链表类（带头结点）"""

    def __init__(self):
        self.head = ListNode()
        self._size = 0

    def is_empty(self) -> bool:
        return self._size == 0

    def length(self) -> int:
        return self._size

    def head_insert(self, val):
        """头插法 O(1)"""
        node = ListNode(val, self.head.next)
        self.head.next = node
        self._size += 1

    def tail_insert(self, val):
        """尾插法 O(n)"""
        p = self.head
        while p.next:
            p = p.next
        p.next = ListNode(val)
        self._size += 1

    def get(self, index: int) -> ListNode:
        """按位查找 O(n)"""
        if index < 0 or index >= self._size:
            raise IndexError("下标越界")
        p = self.head.next
        for _ in range(index):
            p = p.next
        return p

    def locate(self, val) -> int:
        """按值查找"""
        p = self.head.next
        i = 0
        while p:
            if p.val == val:
                return i
            p = p.next
            i += 1
        return -1

    def insert(self, index: int, val):
        """在第 index 个位置插入"""
        if index < 0 or index > self._size:
            raise IndexError("插入位置非法")
        prev = self.head
        for _ in range(index):
            prev = prev.next
        prev.next = ListNode(val, prev.next)
        self._size += 1

    def delete(self, index: int):
        """删除第 index 个结点"""
        if index < 0 or index >= self._size:
            raise IndexError("删除位置非法")
        prev = self.head
        for _ in range(index):
            prev = prev.next
        deleted = prev.next
        prev.next = deleted.next
        self._size -= 1
        return deleted.val

    def display(self):
        items = []
        p = self.head.next
        while p:
            items.append(str(p.val))
            p = p.next
        print(" -> ".join(items) if items else "空链表")


if __name__ == "__main__":
    print("=" * 40)
    print("单链表操作演示")
    print("=" * 40)

    ll = LinkedList()
    for v in [10, 20, 30, 40, 50]:
        ll.tail_insert(v)
    print("尾插 10~50:", end="  ")
    ll.display()

    ll.head_insert(5)
    print("头插 5:   ", end="     ")
    ll.display()

    ll.insert(3, 25)
    print("下标 3 插入 25:", end=" ")
    ll.display()

    print(f"下标 2 的结点值: {ll.get(2).val}")
    print(f"值 30 的位置: {ll.locate(30)}")

    d = ll.delete(0)
    print(f"删除下标 0 ({d}):   ", end=" ")
    ll.display()

    print(f"\n[闪电] 链表: 插入/删除 O(1)（已知位置）")
    print(f"          查找 O(n)（无法随机访问）")
