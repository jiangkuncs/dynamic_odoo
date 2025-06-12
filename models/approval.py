from odoo import fields, models, api


class ApprovalButton(models.Model):
    """
    审批按钮模型
    用于定义需要审批的按钮及其关联的审批规则
    """
    _name = "studio.button"

    # 按钮标识符
    name = fields.Char(string="Button Id")
    # 关联的模型
    model_id = fields.Many2one(comodel_name="ir.model", string="Model")
    # 关联的审批规则
    rule_ids = fields.One2many('studio.approval.rule', 'button_id', string='Rules')


ApprovalButton()


class ApprovalRule(models.Model):
    """
    审批规则模型
    用于定义具体的审批规则，包括审批组和按钮关联
    """
    _name = "studio.approval.rule"

    # 审批组
    group_id = fields.Many2one(comodel_name="res.groups", string="Groups")
    # 关联的审批按钮
    button_id = fields.Many2one(comodel_name="studio.button", string="Button")
    # 规则描述
    description = fields.Char(string="Description")
    # 是否激活（已注释）
    # active = fields.Boolean(string="Active")


ApprovalRule()


class ApprovalDetails(models.Model):
    """
    审批详情模型
    用于记录具体的审批流程和状态
    """
    _name = "studio.approval.details"

    # 记录ID
    res_id = fields.Integer(string="Record Id")
    # 关联的模型
    model_id = fields.Many2one(comodel_name="ir.model", string="Model")
    # 关联的审批规则
    rule_id = fields.Many2one(comodel_name="studio.approval.rule", string="Rule")
    # 审批状态：等待/接受/拒绝
    state = fields.Selection(selection=[
        ['wait', 'Wait'], 
        ['accept', 'Accept'], 
        ['decline', 'Decline']
    ], ondelete='cascade', default="wait")
    # 审批人
    user_accepted = fields.Many2one(comodel_name="res.users", string="User Accepted")
    # 审批时间
    date_accepted = fields.Datetime(string="Date Accepted")

    @api.model
    def get_approval(self, res_id, model):
        """
        获取审批信息
        根据记录ID和模型获取相关的审批信息
        
        参数:
            res_id: 记录ID
            model: 模型名称
        返回:
            包含审批详情的字典
        """
        # 查找模型
        model = self.env['ir.model'].search([['model', '=', model]])
        # 查找相关的审批按钮
        buttons = self.env["studio.button"].search([["model_id", "=", model.id]])
        # 查找现有的审批记录
        approval = self.search([["res_id", "=", res_id], ["model_id", "=", model.id]])
        rule_ids, result = [ap.rule_id.id for ap in approval], {}
        
        # 为未创建审批记录的规则创建新记录
        for button in buttons:
            for rule in button.rule_ids:
                if rule.id not in rule_ids:
                    self.create({'res_id': res_id, 'model_id': model.id, 'rule_id': rule.id})
        
        # 组织审批信息
        for approval in self.search([["res_id", "=", res_id], ["model_id", "=", model.id]]):
            button_name = approval.rule_id.button_id.name
            if button_name not in result:
                result[button_name] = []
            result[button_name].append({
                'id': approval.id,
                'button': button_name,
                'state': approval.state,
                'group_id': approval.rule_id.group_id.id,
                'group_name': approval.rule_id.group_id.name,
                'user_accepted': approval.user_accepted.display_name,
                'date_accepted': approval.date_accepted,
                'user_id': approval.user_accepted.id
            })
        return result

    def approval_update(self, values):
        """
        更新审批状态
        更新审批信息并通知相关用户
        
        参数:
            values: 要更新的值
        """
        # 更新审批记录
        self.write(values)
        # 获取更新后的审批信息
        notifications, approval = [], self.get_approval(self.res_id, self.model_id.model)
        # 向所有用户发送通知
        for user in self.env.user.search([]):
            notifications.append([
                (self._cr.dbname, 'res.partner', user.partner_id.id),
                {
                    'type': 'approval_data',
                    'approval': approval,
                    'partner_id': user.partner_id.id
                }
            ])
        self.env['bus.bus'].sendmany(notifications)


ApprovalDetails()
