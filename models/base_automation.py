from odoo import fields, models, api


class IrRule(models.Model):
    """
    记录规则扩展
    用于在Studio模式下显示和管理记录规则
    """
    _inherit = "ir.rule"

    # 添加模型名称字段，方便在Studio中显示
    model_name = fields.Char(string="Model Name", related='model_id.model')


IrRule()


class IrFilter(models.Model):
    """
    过滤器扩展
    用于在Studio模式下显示和管理过滤器
    """
    _inherit = "ir.filters"

    # 添加模型名称字段，通过计算字段获取
    model_name = fields.Char(string="Model Name", compute="_compute_model_id")

    @api.depends('model_id')
    def _compute_model_id(self):
        """
        计算模型名称
        当模型ID改变时更新模型名称
        """
        for item in self:
            item.model_name = item.model_id


IrFilter()


class IrModelAccess(models.Model):
    """
    模型访问权限扩展
    用于在Studio模式下显示和管理访问权限
    """
    _inherit = "ir.model.access"

    # 添加模型名称字段，方便在Studio中显示
    model_name = fields.Char(string="Model Name", related='model_id.model')


IrModelAccess()


class BaseAutomation(models.Model):
    """
    自动化规则扩展
    用于在Studio模式下配置自动化动作
    """
    _inherit = "base.automation"

    # 扩展触发器类型，添加按钮动作触发
    trigger = fields.Selection(selection_add=[('button_action', 'Button Action')], 
                             ondelete={'button_action': 'cascade'})


BaseAutomation()


class IrServerObjectLines(models.Model):
    """
    服务器动作行扩展
    用于在Studio模式下配置服务器动作
    """
    _inherit = "ir.server.object.lines"

    @api.onchange('resource_ref', 'evaluation_type')
    def _set_resource_ref(self):
        """
        设置资源引用
        当资源引用或评估类型改变时触发
        """
        super(IrServerObjectLines, self)._set_resource_ref()


IrServerObjectLines()
