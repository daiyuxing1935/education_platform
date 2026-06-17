"""冒泡排序（Bubble Sort）

重复遍历，相邻逆序则交换。每趟将最大值"冒泡"到最后。
优化：无交换时提前结束。
时间复杂度 O(n²)，最优 O(n)
"""

def bubble_sort(arr: list) -> list:
    n = len(arr)
    for i in range(n - 1):
        swapped = False
        for j in range(n - 1 - i):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j+1] = arr[j+1], arr[j]; swapped = True
        if not swapped: break
        print(f"  第{i+1}趟: {arr}")
    return arr

if __name__ == "__main__":
    print("冒泡排序演示")
    data = [64, 34, 25, 12, 22, 11, 90]
    print(f"原始: {data}\n")
    sorted_data = bubble_sort(data.copy())
    print(f"\n结果: {sorted_data}")
    print(f"稳定: [是] | 原地: [是] | O(n^2)")
