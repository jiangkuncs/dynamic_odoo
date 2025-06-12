from odoo import models, api, fields
from odoo.addons.base.models import ir_ui_view
from odoo.tools.safe_eval import safe_eval
from lxml import etree
import random
from odoo.exceptions import UserError

# 保存原始的transfer_node_to_modifiers函数
super_transfer_node_to_modifiers = ir_ui_view.transfer_node_to_modifiers


def inherit_transfer_node_to_modifiers(node, modifiers, context=None, current_node_path=None):
    """
    继承并扩展节点修饰符转换函数
    用于处理Studio模式下的特殊节点属性
    
    参数:
        node: XML节点
        modifiers: 修饰符字典
        context: 上下文
        current_node_path: 当前节点路径
    """
    # 调用原始函数
    super_transfer_node_to_modifiers(node, modifiers, context=context, current_node_path=current_node_path)
    # 在Studio模式下处理特殊属性
    if context.get("STUDIO", False):
        # 处理props_modifier属性
        if node.get('props_modifier'):
            modifiers.update(safe_eval(node.get('props_modifier')))
        # 处理树视图中的invisible属性
        node_path = current_node_path or ()
        if 'tree' in node_path and 'header' not in node_path and node.get("invisible"):
            v = str(safe_eval(node.get("invisible"), {'context': context or {}}))
            if v.find("[") >= 0:
                modifiers["invisible"] = v
                del modifiers["column_invisible"]


# 替换原始函数
ir_ui_view.transfer_node_to_modifiers = inherit_transfer_node_to_modifiers


class IrUiView(models.Model):
    """
    视图模型扩展
    用于处理动态视图的创建和修改
    """
    _inherit = 'ir.ui.view'

    # 添加计划视图类型
    type = fields.Selection(selection_add=[('plan', 'Planning')], ondelete={'plan': 'cascade'})

    def _apply_groups(self, node, name_manager, node_info):
        """
        应用用户组权限
        
        参数:
            node: XML节点
            name_manager: 名称管理器
            node_info: 节点信息
        """
        groups = node.get('groups')
        res = super(IrUiView, self)._apply_groups(node, name_manager, node_info)
        # 在Studio模式下保留groups属性
        if self.env.context.get("STUDIO", False) and groups:
            node.set('groups', groups)
        return res

    @api.constrains('arch_db')
    def _check_xml(self):
        """
        检查XML架构
        对Studio视图中心跳过检查
        """
        if "view_center" in self.name:
            return True
        return super(IrUiView, self)._check_xml()

    def remove_view(self):
        """
        删除视图及其关联的动作视图
        """
        self.env['ir.actions.act_window.view'].search([['view_id', 'in', self.ids]]).unlink()
        return self.unlink()

    @api.model
    def create_new_view(self, values):
        """
        创建新视图
        
        参数:
            values: 包含视图配置的字典
        返回:
            创建的视图ID
        """
        view_mode = values.get('view_mode', False)
        action_id = values.get('action_id', False)
        data = values.get("data", {})
        # 创建视图
        view_id = self.env['ir.ui.view'].create(data)
        if action_id:
            if view_mode == "search":
                # 处理搜索视图
                self.env['ir.actions.act_window'].browse(action_id).write({'search_view_id': view_id.id})
            else:
                # 创建动作视图关联
                values_action_view = {
                    'sequence': 100, 
                    'view_id': view_id.id,
                    'act_window_id': action_id, 
                    'view_mode': view_mode
                }
                self.env['ir.actions.act_window.view'].create(values_action_view)
        return view_id.id

    def read(self, fields=None, load='_classic_read'):
        """
        重写read方法，处理报表模板
        
        参数:
            fields: 要读取的字段列表
            load: 加载方式
        返回:
            视图数据
        """
        report_id = self.env.context.get("REPORT_ID", False)
        res = super(IrUiView, self).read(fields=fields, load=load)
        # 处理报表模板
        if len(self) == 1 and self.type == "qweb" and report_id:
            template = self.env['report.center'].search([
                ['view_id', '=', self.id], 
                ['report_id', '=', report_id]
            ], limit=1)
            if len(template):
                for view in res:
                    view['arch'] = template.xml
        return res

    @api.model
    def get_views(self):
        """
        获取预定义的视图配置
        
        返回:
            包含各种视图配置的字典
        """
        return {
            'translation': [
                [self.env.ref('base.view_translation_dialog_tree').id, 'list'],
                [self.env.ref('base.view_translation_search').id, 'search']
            ],
            'controller': [[False, 'list'], [False, 'form']],
            'automation': [
                [False, 'list'], 
                [False, 'form'],
                [self.env.ref('base_automation.view_base_automation_search').id, 'search']
            ],
            'access_control': [
                [False, 'list'], 
                [False, 'form'],
                [self.env.ref('base.ir_access_view_search').id, 'search']
            ],
            'filter_rules': [
                [False, 'list'], 
                [False, 'form'],
                [self.env.ref('base.ir_filters_view_search').id, 'search']
            ],
            'record_rules': [
                [False, 'list'], 
                [False, 'form'], 
                [self.env.ref('base.view_rule_search').id, 'search']
            ]
        }

    def duplicate_template(self, old_report, new_report):
        """
        复制报表模板
        
        参数:
            old_report: 原报表ID
            new_report: 新报表ID
        返回:
            复制的视图记录
        """
        # 复制视图
        new = self.copy()
        # 生成新的键名
        cloned_templates, new_key = self.env.context.get('cloned_templates', {}), '%s_cp_%s' % (
            new.key.split("_cp_")[0], random.getrandbits(30))
        self, studio_center = self.with_context(cloned_templates=cloned_templates), self.env['report.center']
        cloned_templates[new.key], arch_tree = new_key, etree.fromstring(self._read_template(self.id))

        # 处理模板调用
        for node in arch_tree.findall(".//t[@t-call]"):
            template_call = node.get('t-call')
            if '{' in template_call:
                continue
            if template_call not in cloned_templates:
                # 复制被调用的模板
                template_view = self.search([('key', '=', template_call)], limit=1)
                template_copy = template_view.duplicate_template(old_report, new_report)
                studio_view = studio_center.search([
                    ['view_id', '=', template_view.id], 
                    ['report_id', '=', old_report]
                ], limit=1)
                if studio_view:
                    studio_view.copy({'view_id': template_copy.id, 'report_id': new_report})
            node.set('t-call', cloned_templates[template_call])

        # 更新模板名称
        subtree = arch_tree.find(".//*[@t-name]")
        if subtree is not None:
            subtree.set('t-name', new_key)
            arch_tree = subtree

        # 更新视图属性
        new.write({
            'name': '%s Copy' % new.name,
            'key': new_key,
            'arch_base': etree.tostring(arch_tree, encoding='unicode'),
            'inherit_id': False,
        })
        return new


class IrUiMenu(models.Model):
    """
    菜单模型扩展
    用于处理动态菜单的创建和管理
    """
    _inherit = 'ir.ui.menu'

    # 关联的模型
    model_id = fields.Many2one(string="Model", comodel_name="ir.model")

    @api.model
    def create_new_app(self, values):
        """
        创建新应用
        
        参数:
            values: 包含应用配置的字典
        返回:
            创建的应用信息
        """
        app_name, menu_name, model_name, web_icon_data = values.get("app_name", False), values.get("object_name",
                                                                                                   False), values.get(
            "model_name", False), values.get("web_icon_data", False)
        if app_name:
            # 创建应用菜单
            app_menu = self.create({
                'name': app_name, 
                'parent_id': False, 
                'sequence': 100, 
                'web_icon_data': web_icon_data
            })
            # 创建父级菜单
            parent_menu = self.create({
                'name': menu_name, 
                'parent_id': app_menu.id, 
                'sequence': 1
            })
            values['parent_id'] = parent_menu.id
            result = self.create_new_menu(values)
            result['menu_id'] = app_menu.id
            return result
        return False

    @api.model
    def create_new_model(self, model_des, model_name):
        """
        创建新模型
        
        参数:
            model_des: 模型描述
            model_name: 模型名称
        返回:
            创建的模型ID
        """
        # 创建模型配置
        model_values = {
            'name': model_des, 
            'model': model_name, 
            'state': 'manual',
            'is_mail_thread': True, 
            'is_mail_activity': True,
            'access_ids': [(0, 0, {
                'name': 'Group No One', 
                'group_id': self.env.ref('base.group_no_one').id, 
                "perm_read": True, 
                "perm_write": True,
                "perm_create": True, 
                "perm_unlink": True
            })]
        }
        return self.env['ir.model'].create(model_values).id

    @api.model
    def create_action_wd(self, model_name):
        """
        创建窗口动作
        
        参数:
            model_name: 模型名称
        返回:
            创建的动作ID
        """
        # 创建窗口动作
        action_window_values = {
            'name': 'New Model', 
            'res_model': model_name,
            'view_mode': "tree,form", 
            'target': 'current', 
            'view_id': False
        }
        action_id = self.env['ir.actions.act_window'].create(action_window_values)

        # 创建树视图
        view_data = {
            "arch": "<tree><field name='id' /></tree>", 
            "model": model_name,
            "name": "{model}.tree.{key}".format(model=model_name, key=random.getrandbits(30))
        }
        view_id = self.env['studio.view.center'].create_new_view({
            'view_mode': 'tree', 
            'action_id': action_id.id, 
            "data": view_data
        })

        # 创建表单视图
        view_data = {
            "arch": "<form><header></header><sheet><div class='oe_button_box' name='button_box'></div><field name='id' invisible='True' /></sheet></form>",
            "model": model_name,
            "name": "{model}.form.{key}".format(model=model_name, key=random.getrandbits(30))
        }
        self.env['studio.view.center'].create_new_view({
            'view_mode': 'form', 
            'action_id': action_id.id, 
            "data": view_data
        })

        # 创建视图数据记录
        self.env['ir.model.data'].create({
            'module': 'odo_studio',
            'name': view_data['name'],
            'model': 'ir.ui.view',
            'res_id': view_id.id,
        })
        return action_id.id

    @api.model
    def create_new_menu(self, values):
        """
        创建新菜单
        
        参数:
            values: 包含菜单配置的字典
        返回:
            创建的菜单信息
        """
        model_name, model_id, menu_name, empty_view = values.get("model_name", False), values.get("model_id", False), \
                                                      values.get("object_name", False), values.get("empty_view", False)
        action_id, parent_id, sequence = False, values.get("parent_id", False), values.get("sequence", False)

        # 处理模型创建
        if model_name:
            model_id = self.create_new_model(menu_name, model_name)
            action_id = self.create_action_wd(model_name)
        else:
            model_obj = self.env['ir.model'].browse(model_id)
            if empty_view:
                action_id = self.create_action_wd(model_obj.model)
            else:
                # 查找现有动作
                action_ids = self.env['ir.actions.act_window'].search([('res_model', '=', model_obj.model)])
                if len(action_ids):
                    has_view = action_ids.filtered(lambda x: x.view_id != False)
                    if len(has_view):
                        has_tree = has_view.filtered(lambda x: (x.view_mode or "").find("tree") >= 0)
                        action_ids = has_tree if len(has_tree) else has_view
                    action_id = action_ids[0].id

        # 创建菜单
        if model_id:
            menu = self.create({
                'name': menu_name, 
                'parent_id': parent_id, 
                'sequence': sequence or 1,
                'action': '%s,%s' % ('ir.actions.act_window', action_id)
            })
            return {'action_id': action_id, 'menu_id': menu.id}
        return False

    @api.model
    def update_menu(self, menu_update, menu_delete):
        """
        更新菜单
        
        参数:
            menu_update: 要更新的菜单配置
            menu_delete: 要删除的菜单ID列表
        """
        self.browse(menu_delete).unlink()
        for menu in menu_update:
            self.browse(int(menu)).write(menu_update[menu])

    @api.model
    def get_form_view_id(self):
        """
        获取表单视图ID
        
        返回:
            Studio菜单表单视图ID
        """
        return self.env.ref('dynamic_odoo.ir_ui_menu_studio_form_view').id
