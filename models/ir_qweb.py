import ast
from lxml import etree
from odoo.tools.json import scriptsafe
from textwrap import dedent

from odoo.addons.base.models.qweb import QWeb
from odoo import models, api


class IrQWeb(models.AbstractModel, QWeb):
    """
    QWeb模板引擎扩展
    用于处理Studio模式下的模板渲染和编辑
    """
    _inherit = 'ir.qweb'

    def _render(self, template, values=None, **options):
        """
        重写渲染方法
        处理Studio模式下的特殊渲染需求
        
        参数:
            template: 模板ID或内容
            values: 渲染值
            options: 渲染选项
        返回:
            渲染后的内容
        """
        if values is None:
            values = {}
        # 添加安全的JSON处理函数
        values['json'] = scriptsafe
        # 在Studio模式下清除缓存
        if self.is_studio():
            self.clear_caches()
        return super(IrQWeb, self)._render(template, values=values, **options)

    @api.model
    def load_template(self, view_id):
        """
        加载模板
        
        参数:
            view_id: 视图ID
        返回:
            模板XML字符串
        """
        element = self.get_template(int(view_id), {"full_branding": self.is_studio()})[0]
        return etree.tostring(element)

    def get_template(self, template, options):
        """
        获取模板
        在Studio模式下添加编辑所需的属性
        
        参数:
            template: 模板ID或内容
            options: 模板选项
        返回:
            (模板元素, 文档)
        """
        element, document = super(IrQWeb, self).get_template(template, options)
        if self.is_studio():
            # 获取视图ID
            view_id = self.env['ir.ui.view']._view_obj(template).id
            if not view_id:
                raise ValueError("Template '%s' undefined" % template)

            # 为每个节点添加编辑属性
            root = element.getroottree()
            basepath = len('/'.join(root.getpath(root.xpath('//*[@t-name]')[0]).split('/')[0:-1]))
            for node in element.iter(tag=etree.Element):
                node.set('data-oe-id', str(view_id))
                node.set('data-oe-xpath', root.getpath(node)[basepath:])
        return (element, document)

    def _is_static_node(self, el, options):
        """
        判断节点是否为静态节点
        在Studio模式下禁用静态节点优化
        
        参数:
            el: 节点元素
            options: 选项
        返回:
            是否为静态节点
        """
        return not self.is_studio() and super(IrQWeb, self)._is_static_node(el, options)

    def is_studio(self):
        """
        检查是否处于Studio模式
        
        返回:
            是否为Studio模式
        """
        return self.env.context.get("STUDIO", False)

    def _compile_widget_options(self, el):
        """
        编译小部件选项
        在Studio模式下保存原始选项
        
        参数:
            el: 节点元素
        返回:
            编译后的选项
        """
        if self.is_studio():
            options = el.get("t-options")
            if options:
                el.set("data-oe-options", options)
        return super(IrQWeb, self)._compile_widget_options(el)

    def _compile_directive_field(self, el, options):
        """
        编译字段指令
        在Studio模式下保存字段信息
        
        参数:
            el: 节点元素
            options: 编译选项
        返回:
            编译后的节点
        """
        if self.is_studio():
            el.set('oe-field', el.get('t-field'))
        res = super(IrQWeb, self)._compile_directive_field(el, options)
        return res

    def _compile_directive_esc(self, el, options):
        """
        编译转义指令
        在Studio模式下保存转义信息
        
        参数:
            el: 节点元素
            options: 编译选项
        返回:
            编译后的节点
        """
        if self.is_studio():
            el.set("oe-esc", el.get("t-esc"))
        return super(IrQWeb, self)._compile_directive_esc(el, options)

    def _compile_all_attributes(self, el, options, attr_already_created=False):
        """
        编译所有属性
        在Studio模式下添加上下文信息
        
        参数:
            el: 节点元素
            options: 编译选项
            attr_already_created: 属性是否已创建
        返回:
            编译后的属性列表
        """
        body = []
        if self.is_studio():
            attr_already_created = True

            # 创建有序字典存储属性
            body = [
                # t_attrs = OrderedDict()
                ast.Assign(
                    targets=[ast.Name(id='t_attrs', ctx=ast.Store())],
                    value=ast.Call(
                        func=ast.Name(id='OrderedDict', ctx=ast.Load()),
                        args=[],
                        keywords=[], 
                        starargs=None, 
                        kwargs=None
                    )
                ),
            ] + ast.parse(dedent("""
                # 添加上下文信息
                t_attrs['data-oe-context'] = values['json'].dumps({
                    key: type(values[key]).__name__
                    for key in values.keys()
                    if  key
                        and key != 'true'
                        and key != 'false'
                        and not key.startswith('_')
                        and ('_' not in key or key.rsplit('_', 1)[0] not in values or key.rsplit('_', 1)[1] not in ['even', 'first', 'index', 'last', 'odd', 'parity', 'size', 'value'])
                        and (type(values[key]).__name__ not in ['LocalProxy', 'function', 'method', 'Environment', 'module', 'type'])
                })
                """)).body

        return body + super(IrQWeb, self)._compile_all_attributes(el, options,
                                                                  attr_already_created=attr_already_created)
