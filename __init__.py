# 导入models包中的所有模块
from . import models
# 导入Odoo环境相关模块
from odoo.api import Environment, SUPERUSER_ID
# 导入翻译和异常处理模块
from odoo import _, exceptions
from odoo.exceptions import ValidationError


def pre_install_hooks(cr):
    """
    预安装钩子函数
    用于在模块安装前进行检查和必要的处理
    
    参数:
        cr: 数据库游标对象
    """
    # 创建环境实例，使用超级管理员权限
    env = Environment(cr, SUPERUSER_ID, {})
    # 检查是否已安装ks_list_view_manager模块
    studio_mudule = env['ir.module.module'].sudo().search([('name', '=', 'ks_list_view_manager'), ('state', '=', 'installed')])
    if studio_mudule:
        # 如果已安装，获取安装向导动作
        action = env.ref('base_automation.view_roke_install_studio_wizard_action')
        # 显示警告消息，提示用户确认是否继续安装
        msg = _("studio模块包含list列表设置功能。点击确认按步骤继续；点击取消放弃安装")
        raise exceptions.RedirectWarning(msg, action.id, _('确认'))
        # 以下代码已被注释
        # raise exceptions.RedirectWarning()
        # uninstalled = studio_mudule.button_immediate_uninstall()