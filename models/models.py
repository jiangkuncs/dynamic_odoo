from odoo.models import BaseModel, AbstractModel
from odoo import api, models
from lxml import etree

_fields_view_get = AbstractModel.fields_view_get
_new = BaseModel.new


@api.model
def new(self, values={}, origin=None, ref=None):
    """
    重写模型的new方法，用于处理Studio模式下的记录创建
    
    参数:
        values: 新记录的字段值字典
        origin: 原始记录（用于复制）
        ref: 引用标识符
    
    返回:
        新创建的记录
    """
    record = _new(self, values=values, origin=origin, ref=ref)
    if self.env.context.get("STUDIO", False):
        for name in values:
            field = self._fields.get(name)
            if field and field.inherited:
                chain = field.related
                if isinstance(field.related, str):
                    chain = field.related.split('.', 1)
                parent_name, name = chain
                partner_record = record[parent_name]
                if isinstance(partner_record.id, models.NewId) or partner_record.id:
                    partner_record._update_cache({name: record[name]})
    return record


def fnc_button_studio(self):
    """
    处理Studio模式下的按钮动作
    
    从上下文中获取按钮动作ID，并执行相应的自动化动作
    """
    context = self.env.context
    button_action = context.get("BUTTON_ACTION", False) or context.get("params", {}).get('BUTTON_ACTION', False)
    if button_action:
        action = self.env['base.automation'].search([('id', '=', button_action)])
        if action:
            action.with_context(__action_done={})._process(self)


AbstractModel.fnc_button_studio = fnc_button_studio


@api.model
def fields_view_get(self, view_id=None, view_type='form', toolbar=False, submenu=False):
    """
    重写fields_view_get方法，用于处理Studio模式下的视图获取
    
    参数:
        view_id: 视图ID
        view_type: 视图类型（form, tree等）
        toolbar: 是否包含工具栏
        submenu: 是否包含子菜单
    
    返回:
        处理后的视图定义字典
    """
    res = _fields_view_get(self, view_id=view_id, view_type=view_type, toolbar=toolbar, submenu=submenu)
    # only use in Studio Edit
    res['fieldsGet'] = self.env[self._name].fields_get()
    action_id = self.env.context.get("action_id", False) or self.env.context.get("action", False) or self.env.context.get("params", {}).get("action_id", False)
    if 'studio.view.center' in self.env.registry.models and res and action_id:
        view_ref = self.env.context.get(view_type + "_view_ref", False)
        ui_view = self.env['ir.ui.view']
        model_view = 'studio.view.center'
        domain = [['id', '=', -1]]
        if 'view_id' in res:
            domain = [['view_id', '=', res['view_id']], ['action_id', '=', action_id], ['arch', '!=', False]]
        elif 'view_id' not in res and view_ref and view_ref.find("odoo_studio") >= 0:
            domain = [['view_key', '=', view_ref.replace("odoo_studio.", "")]]
        view_center = self.env[model_view].search(domain, limit=1)
        # old_fields = res['fields']
        # only use in Studio
        # for field_name in old_fields:
        #     old_field = old_fields[field_name]
        #     if 'views' in old_field and len(old_field['views'].keys()):
        #         fields_get = self.env[old_field['relation']].fields_get()
        #         for view in old_field['views'].values():
        #             view['fieldsGet'] = fields_get
        res['arch_original'] = res['arch']
        if len(view_center):
            x_arch, x_fields = ui_view.with_context(STUDIO=True).postprocess_and_fields(
                etree.fromstring(view_center.arch), model=self._name)

            res['arch'] = x_arch
            res['fields'] = x_fields
            res['view_studio_id'] = view_center.id
            res['view_key'] = view_center.view_key
            res['arch_original'] = x_arch
        # only use in Studio
        for field_name in res['fields']:
            x_field = res['fields'][field_name]
            if 'views' in x_field and len(x_field['views'].keys()):
                fields_get = self.env[x_field['relation']].fields_get()
                for view in x_field['views'].values():
                    view['fieldsGet'] = fields_get

    return res


BaseModel.new = new
AbstractModel.fields_view_get = fields_view_get
