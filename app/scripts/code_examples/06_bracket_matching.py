"""栈的应用：括号匹配与表达式求值

利用栈的 LIFO 特性解决括号匹配和中缀表达式求值问题。
"""
class Stack:
    def __init__(self): self._data = []
    def push(self, val): self._data.append(val)
    def pop(self): return self._data.pop()
    def peek(self): return self._data[-1]
    def is_empty(self): return len(self._data) == 0
    def size(self): return len(self._data)

def is_bracket_matched(expr: str) -> bool:
    pairs = {')': '(', ']': '[', '}': '{'}
    stack = Stack()
    for i, ch in enumerate(expr):
        if ch in '([{': stack.push(ch)
        elif ch in ')]}':
            if stack.is_empty(): return False
            if stack.pop() != pairs[ch]: return False
    return stack.is_empty()

def precedence(op: str) -> int:
    return {'+': 1, '-': 1, '*': 2, '/': 2, '(': 0}.get(op, -1)

def apply_op(a: int, b: int, op: str) -> int:
    if op == '+': return a + b
    if op == '-': return a - b
    if op == '*': return a * b
    if op == '/': return a // b
    return 0

def evaluate_infix(expr: str) -> int:
    nums = Stack(); ops = Stack(); i = 0
    while i < len(expr):
        ch = expr[i]
        if ch == ' ': i += 1; continue
        if ch.isdigit():
            num = 0
            while i < len(expr) and expr[i].isdigit():
                num = num * 10 + int(expr[i]); i += 1
            nums.push(num); continue
        elif ch == '(': ops.push(ch)
        elif ch == ')':
            while not ops.is_empty() and ops.peek() != '(':
                b, a = nums.pop(), nums.pop()
                nums.push(apply_op(a, b, ops.pop()))
            ops.pop()
        elif ch in '+-*/':
            while (not ops.is_empty() and precedence(ops.peek()) >= precedence(ch)):
                b, a = nums.pop(), nums.pop()
                nums.push(apply_op(a, b, ops.pop()))
            ops.push(ch)
        i += 1
    while not ops.is_empty():
        b, a = nums.pop(), nums.pop()
        nums.push(apply_op(a, b, ops.pop()))
    return nums.pop()

if __name__ == "__main__":
    print("=" * 40)
    print("1. 括号匹配")
    for t in ["()", "()[]{}", "([{}])", "(]", "([)]"]:
        print(f"  {t} -> {'[OK]' if is_bracket_matched(t) else '[NO]'}")
    print("\n2. 表达式求值")
    for e in ["3 + 5 * 2", "(1+2)*(3+4)", "2*3+8/4"]:
        print(f"  {e} = {evaluate_infix(e)}")
