"""快速排序（Quick Sort）

分治法：选基准，分左右，递归排序。
平均 O(n log n)，最坏 O(n²)
"""

def quick_sort(arr, low=0, high=None, depth=0):
    if high is None: high = len(arr) - 1
    if low < high:
        pi = partition(arr, low, high, depth)
        quick_sort(arr, low, pi-1, depth+1)
        quick_sort(arr, pi+1, high, depth+1)
    return arr

def partition(arr, low, high, depth=0) -> int:
    pivot = arr[high]; i = low - 1
    for j in range(low, high):
        if arr[j] <= pivot:
            i += 1; arr[i], arr[j] = arr[j], arr[i]
    arr[i+1], arr[high] = arr[high], arr[i+1]
    indent = "  "*depth
    print(f"{indent}基准{pivot}: 划分点{i+1}")
    return i + 1

if __name__ == "__main__":
    print("快速排序演示")
    data = [38, 27, 43, 3, 9, 82, 10]
    print(f"原始: {data}\n")
    sorted_data = quick_sort(data.copy())
    print(f"\n结果: {sorted_data}")
    print(f"平均 O(n log n) | 不稳定")
