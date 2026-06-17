"""顺序表（Sequence List）实现

顺序表是用一组地址连续的存储单元依次存储线性表的数据元素。
支持：初始化、插入、删除、按值查找、按位查找。
"""

class SeqList:
    """顺序表类——基于 Python 列表实现"""

    def __init__(self, capacity: int = 10):
        """初始化空顺序表"""
        self._data = [None] * capacity
        self._size = 0
        self._capacity = capacity

    def is_empty(self) -> bool:
        return self._size == 0

    def is_full(self) -> bool:
        return self._size >= self._capacity

    def length(self) -> int:
        return self._size

    def get(self, index: int):
        """按位查找：O(1) 随机存取"""
        if index < 0 or index >= self._size:
            raise IndexError("下标越界")
        return self._data[index]

    def locate(self, value) -> int:
        """按值查找：返回第一个匹配的位置，-1表示未找到"""
        for i in range(self._size):
            if self._data[i] == value:
                return i
        return -1

    def insert(self, index: int, value):
        """在 index 位置插入 value（0-based）"""
        if self.is_full():
            raise RuntimeError("顺序表已满，无法插入")
        if index < 0 or index > self._size:
            raise IndexError("插入位置非法")
        for i in range(self._size, index, -1):
            self._data[i] = self._data[i - 1]
        self._data[index] = value
        self._size += 1

    def delete(self, index: int):
        """删除 index 位置的元素"""
        if self.is_empty():
            raise RuntimeError("顺序表为空，无法删除")
        if index < 0 or index >= self._size:
            raise IndexError("删除位置非法")
        val = self._data[index]
        for i in range(index, self._size - 1):
            self._data[i] = self._data[i + 1]
        self._size -= 1
        return val

    def display(self):
        items = [str(self._data[i]) for i in range(self._size)]
        print("[" + ", ".join(items) + "]")


if __name__ == "__main__":
    print("=" * 40)
    print("顺序表操作演示")
    print("=" * 40)

    sl = SeqList(8)
    for i, v in enumerate([10, 20, 30, 40, 50], 0):
        sl.insert(i, v)
    print("插入 5 个元素后:", end=" ")
    sl.display()

    sl.insert(2, 25)
    print("在下标 2 处插入 25:     ", end=" ")
    sl.display()

    print(f"下标 3 的元素: {sl.get(3)}")
    print(f"值 25 的位置: {sl.locate(25)}")

    deleted = sl.delete(4)
    print(f"删除下标 4 的元素({deleted}):", end=" ")
    sl.display()

    print(f"\n[闪电] 随机存取 O(1) | 插入/删除 O(n)")
