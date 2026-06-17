"""归并排序（Merge Sort）

分治法：平分成两半，分别排序后合并。
所有情况下均为 O(n log n)，稳定。
"""

def merge_sort(arr: list) -> list:
    if len(arr) <= 1: return arr
    mid = len(arr) // 2
    left = merge_sort(arr[:mid])
    right = merge_sort(arr[mid:])
    return merge(left, right)

def merge(left: list, right: list) -> list:
    result = []; i = j = 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            result.append(left[i]); i += 1
        else:
            result.append(right[j]); j += 1
    result.extend(left[i:]); result.extend(right[j:])
    return result

def merge_sort_inplace(arr, left=0, right=None):
    if right is None: right = len(arr) - 1
    if left >= right: return
    mid = (left + right) // 2
    merge_sort_inplace(arr, left, mid)
    merge_sort_inplace(arr, mid+1, right)
    temp = []; i, j = left, mid+1
    while i <= mid and j <= right:
        if arr[i] <= arr[j]: temp.append(arr[i]); i += 1
        else: temp.append(arr[j]); j += 1
    temp.extend(arr[i:mid+1]); temp.extend(arr[j:right+1])
    arr[left:right+1] = temp

if __name__ == "__main__":
    print("归并排序演示")
    data = [38, 27, 43, 3, 9, 82, 10]
    sorted_data = merge_sort(data)
    print(f"结果: {sorted_data}")
    data2 = data.copy(); merge_sort_inplace(data2)
    print(f"原地: {data2}")
    print(f"稳定: [是] | O(n log n) | 空间 O(n)")
