from odoo import fields, models, api


# class IRModelFields(models.Model):
#     _inherit = "ir.model.fields"
#
#     view_studio_id = fields.Many2one(comodel_name="view.center", string="Studio")
#
#
# IRModelFields()

class ActionsCenter(models.Model):
    """
    动作中心模型
    用于管理动态创建的窗口动作及其视图顺序
    """
    _name = "ir.actions.center"

    # 关联的窗口动作
    action_id = fields.Many2one(string="Action", comodel_name="ir.actions.act_window")
    # 视图顺序，JSON格式存储
    views_order = fields.Char(string="Views Order", default='[]')
    # 动作名称
    name = fields.Char(string="Name")

    @api.model
    def store_action(self, action_id, values):
        """
        存储或更新动作配置
        
        参数:
            action_id: 动作ID
            values: 要更新的值字典
        """
        action_virtual = self.search([('action_id', '=', action_id)], limit=1)
        if not action_virtual:
            action_virtual = self.create({'action_id': action_id})
        return action_virtual.write(values)


ActionsCenter()


class ReportCenter(models.Model):
    """
    报表中心模型
    用于管理动态创建的报表模板和视图
    """
    _name = "report.center"

    # 报表XML内容
    xml = fields.Text(string="Xml")
    # 关联的视图
    view_id = fields.Many2one(string="View id", comodel_name="ir.ui.view")
    # 关联的报表动作
    report_id = fields.Many2one(string="Report Id", comodel_name="ir.actions.report")

    @api.model
    def undo_view(self, report_id):
        """
        撤销报表视图修改
        
        参数:
            report_id: 报表ID
        """
        if report_id:
            return self.search([['report_id', '=', report_id]]).unlink()
        return False

    @api.model
    def create_new_report(self, values):
        """
        创建新的报表
        
        参数:
            values: 包含报表配置的字典
        返回:
            创建的报表信息
        """
        # 创建QWeb视图
        self.env['ir.ui.view']._load_records([dict(xml_id=values.get("xml_id", False), values={
            'name': values.get("name", False),
            'arch': values.get("xml", False),
            'key': values.get("xml_id", False),
            'inherit_id': False,
            'type': 'qweb',
        })])
        # 获取模型ID
        model_id = self.env['ir.model'].search([["model", '=', values['model']]]).id
        # 创建报表动作
        report = self.env["ir.actions.report"].create({
            'model': values['model'],
            "binding_type": "report",
            "binding_model_id": model_id,
            "model_id": model_id,
            "name": values['string'],
            "report_file": values['report_file'],
            "report_name": values['report_name'],
            "report_type": "qweb-pdf",
            "type": "ir.actions.report",
            "xml_id": values['report_xml_id']
        })
        return {'id': report.id, 'name': report.name, 'report_name': report.report_name}

    @api.model
    def store_template(self, data):
        """
        存储报表模板
        
        参数:
            data: 包含模板数据的字典
        """
        report_id = data.get("report_id", False)
        templates = data.get("templates", {})
        if report_id:
            for template_id in templates.keys():
                template_id, template = int(template_id), templates[template_id]
                views_exist = self.search([['view_id', '=', template_id], ['report_id', '=', report_id]], limit=1)
                if len(views_exist) > 0:
                    views_exist.write({'xml': template})
                else:
                    self.create({'xml': template, 'view_id': template_id, 'report_id': report_id})
        return True

    @api.model
    def get_field_widget(self):
        """
        获取所有可用的字段小部件
        
        返回:
            包含所有小部件选项的字典
        """
        all_models = self.env.registry.models
        models_name = all_models.keys()
        widgets = {}
        for model_name in models_name:
            if model_name.find("ir.qweb.field.") >= 0:
                widget_name = model_name.replace("ir.qweb.field.", "")
                self.env[model_name].get_available_options()
                widgets[widget_name] = self.env[model_name].get_available_options()
        return widgets


class ViewCenter(models.Model):
    """
    视图中心模型
    用于管理所有动态创建的视图及其配置
    """
    _name = "studio.view.center"

    # 视图架构XML
    arch = fields.Text(string="Arch")
    # 关联的动作
    action_id = fields.Many2one(string="Action", comodel_name="ir.actions.act_window")
    # 关联的视图
    view_id = fields.Many2one(string="View id", comodel_name="ir.ui.view")
    # 新创建的字段
    new_fields = fields.Many2many('ir.model.fields', string="New Fields", copy=False)
    # 视图唯一标识
    view_key = fields.Char(string="View Key")
    # 父视图中心
    parent_id = fields.Many2one(string="Parent Id", comodel_name="studio.view.center")
    # 父视图
    parent_view_id = fields.Many2one(string="Parent View Id", comodel_name="ir.ui.view")
    # 字段名称
    field_name = fields.Char(string="Field Name")
    # 视图类型
    view_type = fields.Selection([
        ('tree', 'Tree'), 
        ('form', 'Form'), 
        ('kanban', 'Kanban'), 
        ('search', 'Search'),
        ('pivot', 'Pivot'), 
        ('calendar', 'Calendar'), 
        ('graph', 'Graph'), 
        ('plan', 'Plan')
    ], ondelete='cascade', string="View Type")
    # 视图顺序
    views_order = fields.Char(string="Views Order", default="[]")

    @api.model
    def get_button_data(self, res_id, model):
        """
        获取按钮相关数据
        
        参数:
            res_id: 记录ID
            model: 模型名称
        返回:
            包含审批信息的字典
        """
        approval_model = self.env['studio.approval.details']
        approval = approval_model.get_approval(res_id, model)
        return {'approval': approval}

    @api.model
    def create_btn_compute(self, data, field):
        """
        创建计算按钮字段
        
        参数:
            data: 视图数据
            field: 字段配置
        """
        model, field_name, field_relation, action_name = field.pop("model"), field.pop("field_name"), field.pop(
            "field_relation"), field.pop("action_name")
        # 设置计算字段的代码
        field["compute"] = "results = self.env['{model}'].read_group([('{field_relation}', 'in', self.ids)], ['{field_relation}'], ['{field_relation}']) \n" \
                         "dic = {{}} \n" \
                         "for x in results: dic[x['{field_relation}'][0]] = x['{field_relation}_count'] \n" \
                         "for record in self: record['{field_name}'] = dic.get(record.id, 0)".format(
            field_relation=field_relation, field_name=field_name, model=model)
        # 创建关联动作
        action_data = {
            'xml_id': action_name, 
            'name': 'Demo', 
            'type': 'ir.actions.act_window', 
            'res_model': model,
            'view_mode': 'tree,form',
            'context': "{{'search_default_{field_name}': active_id, 'default_{field_name}': active_id}}".format(
                field_name=field_relation)
        }
        action = self.env['ir.actions.act_window'].create(action_data)
        data['arch'] = data['arch'].replace(action_name, str(action.id))

    @api.model
    def update_button(self, model, data, kind):
        """
        更新按钮配置
        
        参数:
            model: 模型名称
            data: 按钮数据
            kind: 更新类型
        """
        model_button, model_rule, model = \
            self.env['studio.button'], self.env['studio.approval.rule'], self.env['ir.model'].search(
                [['model', '=', model]])
        for btn_key in data.keys():
            button, value = model_button.search([['name', '=', btn_key]]), data[btn_key]
            if len(button) == 0:
                button = model_button.create({'name': btn_key, 'model_id': model.id})
            if kind == "approval":
                # 更新审批规则
                for rule in button.rule_ids:
                    group_id = rule.group_id.id
                    if group_id not in value:
                        rule.unlink()
                        continue
                    value.remove(group_id)
                if len(value):
                    model_rule.create([{'button_id': button.id, 'group_id': group} for group in value])

    @api.model
    def get_field_id(self, field_name, model_name):
        """
        获取字段ID
        
        参数:
            field_name: 字段名称
            model_name: 模型名称
        返回:
            字段ID或False
        """
        model_obj = self.env['ir.model'].search([['model', '=', model_name]], limit=1)
        field_obj = self.env['ir.model.fields'].search([['model_id', '=', model_obj.id], ['name', '=', field_name]],
                                                       limit=1)
        if len(field_obj):
            return field_obj.id
        return False

    @api.model
    def get_group_xmlid(self, res_ids=[]):
        """
        获取用户组的XML ID
        
        参数:
            res_ids: 用户组ID列表
        返回:
            逗号分隔的XML ID字符串
        """
        groups = self.env['ir.model.data'].search([['model', '=', 'res.groups'], ['res_id', 'in', res_ids]])
        return ",".join([x.complete_name for x in groups])

    @api.model
    def get_relation_id(self, model):
        """
        获取关联模型的ID和显示名称
        
        参数:
            model: 模型名称
        返回:
            包含模型ID和显示名称的字典
        """
        model_obj = self.env['ir.model'].search([['model', '=', model]], limit=1)
        if len(model_obj):
            return {'id': model_obj.id, 'display_name': model_obj.display_name}
        return {}

    @api.model
    def get_group_id(self, xmlid=""):
        """
        根据XML ID获取用户组信息
        
        参数:
            xmlid: 逗号分隔的XML ID字符串
        返回:
            用户组信息列表
        """
        result = []
        for x in xmlid.split(","):
            group = self.env.ref(x)
            result.append({'id': group.id, 'display_name': group.display_name})
        return result

    @api.model
    def create_m2o_from_o2m(self, new_field):
        """
        从一对多字段创建多对一字段
        
        参数:
            new_field: 包含字段配置的字典
        """
        field_m2one = new_field.get('fieldM2one', {})
        model_m2one = self.env['ir.model'].search([('model', '=', field_m2one.get("model_name", False))])
        field_m2one.update({'model_id': model_m2one.id, 'state': 'manual'})
        del field_m2one['model_name']
        self.env['ir.model.fields'].create(field_m2one)
        del new_field['fieldM2one']

    @api.model
    def create_new_view(self, values):
        """
        创建新视图
        
        参数:
            values: 包含视图配置的字典
        返回:
            创建的视图记录
        """
        view_mode = values.get('view_mode', False)
        action_id = values.get('action_id', False)
        data = values.get("data", {})
        if view_mode == "list":
            view_mode = "tree"
        # 创建视图
        view_id = self.env['ir.ui.view'].create(data)
        # 创建动作视图关联
        values_action_view = {
            'sequence': 100, 
            'view_id': view_id.id,
            'act_window_id': action_id, 
            'view_mode': view_mode
        }
        self.env['ir.actions.act_window.view'].create(values_action_view)
        return view_id

    @api.model
    def store_view(self, data):
        """
        存储视图配置
        
        参数:
            data: 视图配置数据列表
        """
        parent_child = {}
        parent_id = {}
        for values in data:
            # 获取视图键和父级信息
            view_key, parent_stack_id, stack_id = \
                values.get("view_key", False), values.pop("parent_stack_id", False), values.pop("stack_id", False)

            # 搜索已存在的视图
            views_exist = self.search([['view_key', '=', view_key]], limit=1)
            new_fields, model_name, button_data, stack_root_id = \
                values.get("new_fields", False), values.pop("model_name", False), values.pop("button_data",
                                                                                             False), values.pop(
                    "stack_root_id", False)

            # 更新按钮配置
            if button_data and model_name:
                self.update_button(model_name, button_data.get("approval"), "approval")

            # 处理新字段创建
            if model_name and new_fields and len(new_fields):
                model_obj, use_for_compute = self.env['ir.model'].search([('model', '=', model_name)]), values
                if stack_root_id:
                    # 如果存在stack_root_id，使用父级架构
                    for item in data:
                        if item.get("stack_id", False) == stack_root_id:
                            use_for_compute = item
                            break

                # 创建新字段
                for newField in new_fields:
                    if newField['ttype'] == "one2many":
                        self.create_m2o_from_o2m(newField)
                    if newField.pop('compute', False):
                        self.create_btn_compute(use_for_compute, newField)
                    newField.update({'model_id': model_obj.id, 'state': 'manual'})
                values['new_fields'] = [(0, 0, new_field) for new_field in new_fields]

            # 移除不在模型字段中的属性
            for attr in [x for x in values.keys() if x not in self._fields]:
                values.pop(attr)

            # 创建或更新视图
            if len(views_exist):
                views_exist.write(values)
            else:
                self.create(values)

    @api.model
    def reset_view(self, values):
        """
        重置视图到原始状态
        
        参数:
            values: 包含视图信息的字典
        """
        # 实现视图重置逻辑
        pass

    @api.model
    def get_view(self, domain):
        """
        获取视图配置
        
        参数:
            domain: 搜索域
        返回:
            视图配置记录
        """
        # 实现视图获取逻辑
        pass

    @api.model
    def load_field_get(self, model_name):
        """
        加载模型字段信息
        
        参数:
            model_name: 模型名称
        返回:
            字段信息字典
        """
        # 实现字段加载逻辑
        pass

    @api.model
    def create_app(self):
        """
        创建新应用
        
        返回:
            创建的应用信息
        """
        # 实现应用创建逻辑
        pass


ViewCenter()


class StudioButton(models.Model):
    """
    Studio按钮模型
    用于管理动态创建的按钮及其自动化规则
    """
    _name = "view.center.button"

    # 按钮唯一标识
    button_key = fields.Char(string="Button Key", required=True)
    # 关联的自动化规则
    automation_id = fields.Many2one(comodel_name="base.automation", string="Automation")

    @api.model
    def get_button_action_info(self, model_name):
        """
        获取按钮动作信息
        
        参数:
            model_name: 模型名称
        返回:
            按钮动作信息字典
        """
        # 实现按钮动作信息获取逻辑
        pass


StudioButton()
