"""折半查找（Binary Search）

在有序表中查找，每次缩小一半范围。
要求：有序 + 随机存取。
时间复杂度 O(log n)
"""

def binary_search(arr: list[int], target: int) -> int:
    left, right = 0, len(arr) - 1; count = 0
    while left <= right:
        count += 1
        mid = left + (right - left) // 2
        print(f"  第{count}次: left={left}, right={right}, mid={mid}, arr[{mid}]={arr[mid]}")
        if arr[mid] == target: return mid
        elif arr[mid] < target: left = mid + 1
        else: right = mid - 1
    return -1

def lower_bound(arr: list[int], target: int) -> int:
    left, right = 0, len(arr)
    while left < right:
        mid = left + (right - left) // 2
        if arr[mid] < target: left = mid + 1
        else: right = mid
    return left

if __name__ == "__main__":
    print("折半查找演示")
    arr = [8, 17, 26, 32, 39, 45, 53, 61, 74, 88, 96, 100]
    print(f"有序表: {arr}\n")
    print("查找45:"); idx = binary_search(arr, 45); print(f"  位置: {idx}")
    print("\n查找50:"); idx = binary_search(arr, 50); print(f"  位置: {idx}")
    lb = lower_bound(arr, 40)
    print(f"\n第一个>=40: 位置{lb}, 值{arr[lb]}")
    print(f"\n[闪电] O(log n) | 要求有序+随机存取")
