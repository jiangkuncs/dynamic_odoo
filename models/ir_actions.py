from odoo import fields, models, api
import random
import json


class ActionView(models.Model):
    """
    动作视图模型扩展
    用于支持计划视图类型
    """
    _inherit = 'ir.actions.act_window.view'

    # 添加计划视图类型
    view_mode = fields.Selection(selection_add=[('plan', 'Planning')], ondelete={'plan': 'cascade'})


ActionView()


class IrActionsActions(models.Model):
    """
    窗口动作模型扩展
    用于处理动态视图顺序和虚拟数据
    """
    _inherit = "ir.actions.act_window"

    @api.model
    def set_virtual_data(self, record, action_id):
        """
        设置虚拟数据
        用于处理视图顺序和动作名称
        
        参数:
            record: 动作记录
            action_id: 动作ID
        """
        # 获取动作中心记录
        action_virtual = self.env['ir.actions.center'].search([('action_id', '=', action_id)], limit=1)
        if not len(action_virtual):
            return

        # 处理视图顺序
        views_order, virtual_views_order = [], eval(action_virtual.views_order or '[]')
        # 按照虚拟视图顺序排序
        for ac in virtual_views_order:
            ac_exist = list(filter(lambda x: (x[1] == ac), record['views']))
            if len(ac_exist):
                views_order.append(ac_exist[0])
        # 添加未在虚拟顺序中的视图
        if len(views_order):
            for ro in record['views']:
                if ro[1] not in virtual_views_order:
                    views_order.append(ro)
        # 更新动作名称
        record['name'] = record['display_name'] = action_virtual.name
        # 更新视图顺序
        if len(views_order):
            record['views'] = views_order

    def read(self, fields=None, load='_classic_read'):
        """
        重写read方法，处理虚拟数据
        
        参数:
            fields: 要读取的字段列表
            load: 加载方式
        返回:
            动作数据
        """
        res = super(IrActionsActions, self).read(fields=fields, load=load)
        action_id = self.env.context.get("action_id", False)
        if action_id:
            for item in res:
                self.set_virtual_data(item, action_id)
        return res


IrActionsActions()


class IrActionsReport(models.Model):
    """
    报表动作模型扩展
    用于处理报表模板的复制和渲染
    """
    _inherit = 'ir.actions.report'

    @api.model
    def _render_qweb_html(self, docids, data=None):
        """
        重写报表渲染方法
        添加上下文中的报表ID
        
        参数:
            docids: 文档ID列表
            data: 额外数据
        返回:
            渲染后的HTML
        """
        return super(IrActionsReport, self.with_context(REPORT_ID=self.id))._render_qweb_html(docids, data=data)

    def copy_report(self):
        """
        复制报表
        包括复制报表动作和关联的模板
        """
        # 复制报表动作
        new = self.copy()
        # 查找并复制模板视图
        template_view = self.env['ir.ui.view'].search([('key', '=', new.report_name)], limit=1)
        new_template = template_view.with_context(lang=None).duplicate_template(self.id, new.id)
        # 更新报表属性
        new.write({
            'xml_id': '%s_cp_%s' % (new.xml_id.split("_cp_")[0], random.getrandbits(30)),
            'name': '%s Copy' % new.name,
            'report_name': new_template.key,
            'report_file': new_template.key,
        })


IrActionsReport()
