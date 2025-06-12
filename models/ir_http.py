from odoo.models import BaseModel, AbstractModel


class Http(AbstractModel):
    """
    HTTP请求处理模型扩展
    用于处理会话信息和Studio权限
    """
    _inherit = 'ir.http'

    def session_info(self):
        """
        重写会话信息方法
        添加Studio相关权限信息
        
        返回:
            包含用户权限信息的字典
        """
        # 获取基础会话信息
        result = super(Http, self).session_info()
        # 检查用户是否有系统管理员权限
        # 原代码检查dynamic_odoo.group_dynamic权限，现在改为检查系统管理员权限
        if self.env.user.has_group('base.group_system'):
            result['showStudio'] = True
        # 添加用户组信息
        result['user_groups'] = self.env.user.groups_id.ids
        return result


Http()
