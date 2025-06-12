# 导入基础模型定义
from . import models
# 导入视图相关模型，用于处理动态视图的创建和修改
from . import ir_ui_view
# 导入动作相关模型，用于处理动态动作的创建和配置
from . import ir_actions
# 导入HTTP请求处理模型，用于处理动态路由和请求
from . import ir_http
# 导入视图中心模型，用于管理所有动态视图
from . import view_center
# 导入审批流程模型，用于处理动态审批流程
from . import approval
# 导入基础自动化模型，用于处理自动化规则
from . import base_automation
# 导入QWeb模板模型，用于处理动态模板渲染
from . import ir_qweb
