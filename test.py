import subprocess
import datetime
from collections import defaultdict

def generate_weekly_report():
    # --- 1. 修正时间逻辑：从本周一算起 ---
    now = datetime.datetime.now()
    weekday = now.weekday()  # 0=周一, 6=周日
    # 如果今天是周日(6)，timedelta(days=6)回到周一；如果是周一(0)，就是今天
    this_monday = now - datetime.timedelta(days=weekday)
    start_date = this_monday.strftime('%Y-%m-%d')
    
    print(f"📅 正在统计从 {start_date} (周一) 至今的提交记录...\n")

    # --- 2. 执行 Git 命令 ---
    command = [
        'git', 'log', 
        f'--since={start_date}', 
        '--pretty=format:%s',  # 只取提交信息，方便后续处理
        '--date=short'
    ]
    
    try:
        result = subprocess.run(command, capture_output=True, text=True, encoding='utf-8', check=True)
        commits_raw = result.stdout.strip().split('\n') if result.stdout.strip() else []
        
        # --- 3. 分类与润色 (保持之前的逻辑) ---
        # ...这里放入之前的分类字典 CATEGORY_MAP 和 polish_commit 函数...
        # 为了演示简洁，假设你已经有了 categories 字典
        
        # 模拟分类结果 (实际代码请用之前的分类逻辑)
        categories = defaultdict(list)
        for msg in commits_raw:
            categorized = False
            for key in ['feat', 'fix', 'refactor', 'docs']: 
                if msg.lower().startswith(key):
                    categories[key].append(msg)
                    categorized = True
                    break
            if not categorized:
                categories['other'].append(msg)

        # --- 4. 输出带编号的周报 ---
        print("="*40)
        print("📝 本周工作总结")
        print("="*40)
        
        global_index = 1 # 全局编号计数器
        
        # 定义输出顺序
        order = ['feat', 'fix', 'refactor', 'docs', 'other']
        titles = {
            'feat': '✨ 新功能', 'fix': '🐛 问题修复', 
            'refactor': '♻️ 重构', 'docs': '📝 文档', 'other': '🔧 其他'
        }

        for key in order:
            if key in categories:
                print(f"\n【{titles.get(key, '其他')}】")
                for msg in categories[key]:
                    # 简单的润色示例
                    clean_msg = msg.split(':', 1)[-1].strip() if ':' in msg else msg
                    print(f"{global_index}. {clean_msg}") 
                    global_index += 1
                    
        print("\n" + "="*40)

    except Exception as e:
        print(f"出错了: {e}")

if __name__ == "__main__":
    generate_weekly_report()