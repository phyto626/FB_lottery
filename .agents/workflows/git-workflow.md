---
description: Git 版本管理完整工作流程 — 初始化、日常管理、歷史查詢、commit 訊息撰寫、進階操作
---

# Git 版本管理工作流程

> [!IMPORTANT]
> 本專案的 Git 安裝路徑為 `C:\Program Files\Git\cmd\git.exe`。
> 若 PowerShell 無法識別 `git` 指令，請先執行以下設定：
> ```powershell
> $env:Path += ";C:\Program Files\Git\cmd"
> ```
> 或將 `C:\Program Files\Git\cmd` 永久加入系統環境變數 PATH。

---

## 0. 前置準備：設定 Git 環境

// turbo-all

```powershell
# 確認 git 可用
$env:Path += ";C:\Program Files\Git\cmd"
git --version

# 設定使用者資訊（僅需設定一次）
git config --global user.name "你的名字"
git config --global user.email "你的email@example.com"

# 設定預設分支名稱
git config --global init.defaultBranch main

# 設定中文檔名不亂碼
git config --global core.quotepath false
```

---

## 1. 初始化 Git 並連結 GitHub

```powershell
# 進入專案資料夾
cd "c:\Users\orc62\OneDrive\桌面\skills-main"

# 初始化 git 倉庫
git init

# 加入所有檔案
git add .

# 第一次 commit
git commit -m "feat: 初始化專案 — 部署至 GitHub 的初始版本"

# 連結遠端 GitHub 倉庫（替換為你的 GitHub repo URL）
git remote add origin https://github.com/你的帳號/你的repo名稱.git

# 推送到 GitHub
git push -u origin main
```

> [!NOTE]
> 如果你已經在 GitHub 上建立了 repo 並且有 commit 歷史，改用：
> ```powershell
> git remote add origin https://github.com/你的帳號/你的repo名稱.git
> git fetch origin
> git branch --set-upstream-to=origin/main main
> git pull --rebase
> ```

---

## 2. 日常程式碼變更管理

### 查看目前狀態
```powershell
git status          # 查看哪些檔案被修改/新增/刪除
git diff            # 查看具體修改了什麼內容
git diff --staged   # 查看已 staged 的修改
```

### 提交變更
```powershell
# 加入特定檔案
git add path/to/file.js

# 加入所有變更
git add .

# 提交（附上有意義的訊息）
git commit -m "feat: 新增使用者登入功能"
```

### 推送到 GitHub
```powershell
git push origin main
```

### 拉取最新程式碼
```powershell
git pull origin main
```

---

## 3. 查詢歷史紀錄

### 3.1 查看 commit 歷史
```powershell
# 簡要歷史（單行顯示）
git log --oneline -20

# 詳細歷史（含修改檔案）
git log --stat -10

# 圖形化分支歷史
git log --oneline --graph --all

# 搜尋 commit 訊息（例如：找 v1.2.3 相關的變更）
git log --all --oneline --grep="v1.2.3"

# 搜尋特定日期範圍的 commit
git log --after="2026-03-01" --before="2026-03-15" --oneline
```

### 3.2 查詢「這個功能是由誰負責？」
```powershell
# 查看某檔案每一行的最後修改者
git blame path/to/file.js

# 查看某檔案的修改歷史
git log --follow -p path/to/file.js

# 查看某人的所有 commit
git log --author="名字" --oneline
```

### 3.3 查詢「這個 API 為什麼這樣設計？」
```powershell
# 搜尋 commit 訊息中包含特定關鍵字
git log --all --oneline --grep="API"
git log --all --oneline --grep="設計"

# 搜尋程式碼中曾經出現/消失的字串
git log -S "functionName" --oneline

# 查看特定 commit 的完整變更
git show <commit-hash>

# 比較兩個版本之間的差異
git diff v1.0.0..v1.2.3
```

### 3.4 使用 Tag 標記版本
```powershell
# 建立版本標籤
git tag -a v1.0.0 -m "Release v1.0.0: 初始正式版本"

# 查看所有標籤
git tag -l

# 查看特定版本的詳細資訊
git show v1.0.0

# 推送標籤到 GitHub
git push origin v1.0.0
git push origin --tags   # 推送所有標籤
```

---

## 4. 撰寫 Commit 訊息規範

### Conventional Commits 格式

```
<type>(<scope>): <description>

[可選的詳細說明]

[可選的 footer]
```

### Type 類型對照表

| Type       | 用途                     | 範例                                          |
|------------|--------------------------|-----------------------------------------------|
| `feat`     | 新增功能                 | `feat(auth): 新增 Google OAuth 登入`          |
| `fix`      | 修復 bug                 | `fix(api): 修正使用者查詢回傳空值問題`        |
| `docs`     | 文件修改                 | `docs: 更新 README 安裝說明`                  |
| `style`    | 格式調整（不影響邏輯）   | `style: 統一縮排為 2 spaces`                  |
| `refactor` | 重構（不改變功能）       | `refactor(db): 抽取共用查詢方法`              |
| `test`     | 測試相關                 | `test(auth): 新增登入失敗測試案例`            |
| `chore`    | 建置/工具/設定           | `chore: 升級 Node.js 至 v20`                  |
| `perf`     | 性能優化                 | `perf(query): 改用索引查詢提升 50% 速度`      |
| `revert`   | 還原先前的 commit        | `revert: 還原 feat(auth) 修改`                |

### 自動生成 Commit 訊息（請 AI 協助）

當你修改完程式碼後，可以請 AI 幫你生成 commit 訊息：

```powershell
# 先查看有哪些變更
git diff --staged

# 或查看所有未提交的變更
git diff
git status
```

然後將輸出結果提供給 AI，請它根據變更內容生成符合 Conventional Commits 格式的訊息。

---

## 5. 進階 Git 操作

### 5.1 還原檔案

```powershell
# 還原工作目錄中未 staged 的修改（回到上次 commit 的狀態）
git checkout -- path/to/file.js

# 取消已 staged 的檔案（從暫存區移除，但保留修改）
git restore --staged path/to/file.js

# 還原到特定 commit 的檔案版本
git checkout <commit-hash> -- path/to/file.js

# 還原整個 commit（建立新的反向 commit）
git revert <commit-hash>

# 回到某個 commit（注意：會丟失之後的 commit！）
git reset --hard <commit-hash>
```

> [!CAUTION]
> `git reset --hard` 會永久刪除之後的所有變更，請謹慎使用！
> 建議改用 `git revert` 來安全地還原。

### 5.2 分支管理

```powershell
# 建立並切換到新分支
git checkout -b feature/new-feature

# 查看所有分支
git branch -a

# 切換分支
git checkout main

# 合併分支
git merge feature/new-feature

# 刪除已合併的分支
git branch -d feature/new-feature

# 推送新分支到 GitHub
git push -u origin feature/new-feature
```

### 5.3 解決 Rebase 衝突

```powershell
# 將目前分支 rebase 到 main 之上
git rebase main

# 如果遇到衝突：
# 1. 編輯衝突檔案，解決 <<<<<<< / ======= / >>>>>>> 標記
# 2. 標記為已解決
git add path/to/conflicted-file.js

# 3. 繼續 rebase
git rebase --continue

# 如果想放棄 rebase
git rebase --abort
```

### 5.4 比對與合併 Patch

```powershell
# 產生 patch 檔（最近 3 個 commit）
git format-patch -3

# 應用 patch
git apply patch-file.patch

# 應用 patch 並建立 commit
git am patch-file.patch

# 比較兩個分支的差異
git diff main..feature/new-feature

# 比較並輸出到檔案
git diff main..feature/new-feature > changes.patch
```

### 5.5 Stash 暫存（臨時保存未完成的工作）

```powershell
# 暫存目前的修改
git stash save "正在開發的功能，先切換修 bug"

# 查看暫存清單
git stash list

# 恢復最近的暫存
git stash pop

# 恢復指定的暫存
git stash apply stash@{1}
```

### 5.6 Cherry-pick（挑選特定 commit）

```powershell
# 將其他分支的特定 commit 合併到目前分支
git cherry-pick <commit-hash>

# 挑選多個 commit
git cherry-pick <hash1> <hash2> <hash3>
```

---

## 6. 常用情境速查

| 情境 | 指令 |
|------|------|
| 我改壞了，想全部還原 | `git checkout -- .` |
| 我想看上次改了什麼 | `git log -1 -p` |
| 我想找誰改了這行 | `git blame file.js` |
| 我想找某個版本的變更 | `git log --grep="v1.2.3"` |
| 我想取消最後一次 commit（保留修改） | `git reset --soft HEAD~1` |
| 我想暫時保存修改去修 bug | `git stash` |
| 我想把 GitHub 最新的拉下來 | `git pull origin main` |
| 我想看某 commit 改了哪些檔案 | `git show --stat <hash>` |
