odoo.define('dynamic_odoo.ReportKanBan', function (require) {
    "use strict";

    var core = require('web.core');
    var KanbanRenderer = require('web.KanbanRenderer');
    var KanbanView = require('web.KanbanView');
    var KanbanController = require('web.KanbanController');
    var KanbanRecord = require('web.KanbanRecord');


    var KanBanContentRecord = KanbanRecord.extend({
        init: function (parent, state, options) {
            this._super(parent, state, options);
            this.props = options;
        },
        _onGlobalClick: function (ev) {
            if ($(ev.target).parents('.o_dropdown_kanban').length) {
                return;
            }
            const {onClickRecord} = this.props, {data} = this.state;
            onClickRecord(data);
        },
    });

    var KanBanContentRenderer = KanbanRenderer.extend({
        config: _.extend({}, KanbanRenderer.prototype.config, {
            KanbanRecord: KanBanContentRecord,
        }),
        init: function (parent, state, params) {
            this._super(parent, state, params);
            const {onLoadReport} = parent;
            this.recordOptions.onClickRecord = onLoadReport.bind(parent);
        },
    });

    var KanBanContentController = KanbanController.extend({
        _pushState: function () {
        },
        _reloadAfterButtonClick: function (record, params) {
            if (params.attrs.name === 'copy_report') {
                this.trigger_up('reload');
            } else {
                this._super.apply(this, arguments);
            }
        },
        _onButtonNew: function () {
            this.trigger_up("onCreateReport", {});
        }
    });

    var KanBanContentView = KanbanView.extend({
        config: _.extend({}, KanbanView.prototype.config, {
            Renderer: KanBanContentRenderer,
            Controller: KanBanContentController,
        }),
        init: function (viewInfo, params) {
            this._super(viewInfo, params);
            this.props = params;
        }
    });

    return KanBanContentView;

});
