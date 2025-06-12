{
    # 模块名称：社区版Odoo Studio
    'name': 'Odoo Studio for Community',
    # 模块简介
    'summary': 'Odoo Studio for Community',
    # 模块版本号
    'version': '1.0',
    # 模块分类：Web类
    'category': 'Web',
    # 详细描述：无需技术知识即可动态构建和自定义Odoo应用
    'description': """
        Odoo Studio. Build and Customize Odoo Apps on the fly without any technical knowledge.
    """,
    # 作者信息
    'author': "apps.odoo.community@gmail.com",
    # 网站地址
    "website": "odoo-studio.com",
    # 依赖模块：基础自动化模块
    'depends': ['base_automation'],
    # 数据文件列表：包含视图、安全配置等
    'data': [
        'views/templates.xml',          # 基础模板
        # 'views/ir_ui_menu_view.xml',  # 菜单视图（已注释）
        'views/menu_view.xml',          # 菜单视图
        'views/action_studio_view.xml', # Studio动作视图
        'views/report_kanban_view.xml', # 报表看板视图
        'security/view_dynamic_security.xml', # 动态视图安全配置
        'security/ir.model.access.csv', # 模型访问权限配置
    ],
    # QWeb模板文件列表：包含各种前端组件模板
    'qweb': [
        'static/src/xml/report_center.xml',    # 报表中心
        'static/src/xml/views.xml',            # 视图组件
        'static/src/xml/widgets.xml',          # 小部件
        'static/src/xml/base.xml',             # 基础组件
        'static/src/xml/menu.xml',             # 菜单组件
        'static/src/xml/icons.xml',            # 图标组件
        'static/src/xml/fields.xml',           # 字段组件
        'static/src/xml/gantt_view.xml',       # 甘特图视图
        'static/src/xml/planning_view.xml',    # 计划视图
        'static/src/xml/form_components.xml',  # 表单组件
        'static/src/xml/kanban_view.xml',      # 看板视图
        'static/src/xml/dashboard_view.xml',   # 仪表板视图
        'static/src/xml/components.xml',       # 通用组件
    ],
    # 模块图片
    'images': ['images/main_screen.jpg'],
    # 模块价格（欧元）
    'price': 450,
    # 不同版本的价格比较
    'price_comparison': {'standard': 0, 'pro': 200, 'vip': 300},
    # 许可证类型：Odoo专有许可证
    'license': 'OPL-1',
    # 货币单位：欧元
    'currency': 'EUR',
    # 是否可安装
    'installable': True,
    # 是否自动安装
    'auto_install': False,
    # 是否为应用
    'application': False,
    # 模块展示图片
    'images': [
        'static/description/module_image.jpg',
    ],
    # 预安装钩子（已注释）
    # 'pre_init_hook': 'pre_install_hooks',
}
