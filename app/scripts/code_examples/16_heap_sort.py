"""堆排序（Heap Sort）

利用完全二叉树的堆性质排序。
建堆 O(n)，排序 O(n log n)，原地排序。
"""

def heap_sort(arr: list) -> list:
    n = len(arr)
    for i in range(n // 2 - 1, -1, -1):
        _sift_down(arr, i, n - 1)
    print(f"建堆: {arr}")
    for i in range(n - 1, 0, -1):
        arr[0], arr[i] = arr[i], arr[0]
        _sift_down(arr, 0, i - 1)
        print(f"交换{arr[i]}: {arr[:i]}|{arr[i:]}")
    return arr

def _sift_down(arr, start, end):
    root = start
    while True:
        child = 2 * root + 1
        if child > end: break
        if child + 1 <= end and arr[child+1] > arr[child]:
            child += 1
        if arr[child] > arr[root]:
            arr[root], arr[child] = arr[child], arr[root]
            root = child
        else: break

if __name__ == "__main__":
    print("堆排序演示")
    data = [4, 10, 3, 5, 1, 7, 9, 8, 2, 6]
    print(f"原始: {data}\n")
    sorted_data = heap_sort(data.copy())
    print(f"\n结果: {sorted_data}")
    print(f"不稳定 | O(n log n) | 原地")
