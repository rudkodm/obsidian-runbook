---
cwd: /tmp
---

# Phase 8 Test Runbook

Use this note to manually verify all Phase 8 features in Obsidian.
Work through each section, checking the expected results.

---

## 1. Code Block Annotations

### 1a. Named block with cwd

Expected: terminal shows `cd /tmp` then outputs `/tmp`.

```sh {"name":"check-cwd"}
pwd
```

### 1b. Block with all attributes

Expected: play button works, outputs "named block". This block should be skipped by Run All.

```bash {"name":"skip-me","excludeFromRunAll":true,"cwd":"/"}
echo "named block"
pwd
```

### 1c. Block with unknown attributes (forward-compatible)

Expected: runs normally, unknown attributes are ignored.

```sh {"name":"compat","futureFeature":"test","version":2}
echo "forward-compatible attributes work"
```

### 1d. Plain block without annotations

Expected: runs normally with empty attributes.

```bash
echo "plain block, no annotations"
```

---

## 2. Multi-Language Support

### 2a. Python

Expected: outputs "Hello from Python" and the Python version.

```python
print("Hello from Python")
import sys
print(f"Python {sys.version}")
```

### 2b. Python (py alias)

Expected: outputs the result of a calculation.

```py
result = sum(range(1, 11))
print(f"Sum of 1-10 = {result}")
```

### 2c. JavaScript

Expected: outputs "Hello from Node.js" and the Node version.

```javascript
console.log("Hello from Node.js");
console.log(`Node ${process.version}`);
```

### 2d. JavaScript (js alias)

Expected: outputs JSON.

```js
const data = { language: "javascript", working: true };
console.log(JSON.stringify(data, null, 2));
```

### 2e. TypeScript

Expected: outputs typed greeting (requires `npx tsx`).

```typescript
const greeting: string = "Hello from TypeScript";
const count: number = 42;
console.log(`${greeting}, count=${count}`);
```

### 2f. TypeScript (ts alias)

Expected: outputs interface-based data.

```ts
interface Result { status: string; code: number }
const r: Result = { status: "ok", code: 200 };
console.log(JSON.stringify(r));
```

### 2g. Shell (existing)

Expected: outputs working directory and file listing.

```bash
echo "Shell works as before"
pwd
ls -1 | head -5
```

### 2h. Unsupported language (negative test)

Expected: NO play button appears on this block.

```rust
fn main() {
    println!("This should not have a run button");
}
```

---

## 3. Session Isolation

### Instructions

1. Open **this note** and run block 3a below.
2. Open a **different note** and run `echo $PHASE8_TEST` in a bash block there.
3. The variable should be empty in the other note (separate session).
4. Come back here and run block 3b — it should still have the variable.

### 3a. Set a variable in this note's session

```bash
export PHASE8_TEST="session_isolated"
echo "Variable set: PHASE8_TEST=$PHASE8_TEST"
```

### 3b. Read the variable back (same session)

Expected: outputs `session_isolated` (proves session persists per note).

```bash
echo "PHASE8_TEST=$PHASE8_TEST"
```

---

## 4. Run All Cells

### Instructions

1. Open command palette (`Cmd/Ctrl+P`)
2. Search for **"Run all code blocks in current note"**
3. Execute it

### Expected behavior

- Terminal shows progress like `--- Running check-cwd (1/N) ---`
- Block `1b` (skip-me) is **skipped** because `excludeFromRunAll: true`
- All other supported blocks execute sequentially
- Blocks with `cwd` attribute change directory before executing
- Python/JS/TS blocks run via their interpreters
- The `rust` block is skipped (unsupported language)
- The frontmatter `cwd: /tmp` applies as fallback for blocks without their own `cwd`

---

## 5. Frontmatter cwd

This note has `cwd: /tmp` in frontmatter. When using Run All,
blocks without an explicit `cwd` attribute should default to `/tmp`.

```bash {"name":"frontmatter-cwd-test"}
echo "Current directory from frontmatter:"
pwd
```

Expected: outputs `/tmp`.

---

## 6. Edge Cases

### 6a. Empty code block

Expected: "Code block is empty" notice when clicking play.

```bash
```

### 6b. Code with single quotes (escaping test)

Expected: outputs the string with quotes intact.

```python
print("it's working")
print('single quotes: "hello"')
```

### 6c. Multi-line Python

Expected: outputs a loop result.

```python
for i in range(5):
    print(f"Line {i+1}")
```

### 6d. Multi-line JavaScript

Expected: outputs array processing result.

```javascript
const items = ["apple", "banana", "cherry"];
items.forEach((item, i) => {
    console.log(`${i + 1}. ${item}`);
});
```

### 6e. Prompt prefix stripping (shell)

Expected: executes without the `$` prefix.

```bash
$ echo "prompt prefix stripped"
$ whoami
```

---

## Results Checklist

After testing, verify each item:

- [ ] **Annotations**: JSON attributes parse (name, cwd, excludeFromRunAll)
- [ ] **Unknown attributes**: Ignored gracefully
- [ ] **Frontmatter**: `cwd` from frontmatter applies
- [ ] **Python**: Executes via `python3 -c`
- [ ] **JavaScript**: Executes via `node -e`
- [ ] **TypeScript**: Executes via `npx tsx -e`
- [ ] **Shell**: Works as before
- [ ] **Unsupported lang**: No play button on rust block
- [ ] **Session isolation**: Variables don't leak between notes
- [ ] **Session persistence**: Same note reuses its terminal
- [ ] **Terminal tab name**: Shows note name
- [ ] **Run All**: Executes blocks in order
- [ ] **excludeFromRunAll**: Skipped block is not executed
- [ ] **Run All cwd**: Per-cell and frontmatter cwd respected
- [ ] **Run All progress**: Terminal shows "Running cell X/Y" messages
- [ ] **Empty block**: Shows notice
- [ ] **Single quotes**: Escaped correctly in interpreter commands
- [ ] **Multi-line**: Python/JS multi-line blocks work
- [ ] **Prompt prefix**: `$` stripped from shell commands
