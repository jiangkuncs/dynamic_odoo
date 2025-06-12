odoo.define('dynamic_odoo.activity', function (require) {
"use strict";

    var base = require('dynamic_odoo.base');
    var ActivityView = require('mail.ActivityView');
    var ActivityController = require('mail.ActivityController');
    var baseEdit = require('dynamic_odoo.views_edit_base');

    var ActivityControllerEdit = ActivityController.extend({
         _pushState: function () {}
    });

    var ActivityViewEdit = ActivityView.extend({
        config: _.extend({}, ActivityView.prototype.config, {
            Controller: ActivityControllerEdit,
        })
    });

    var ActivityProps = baseEdit.ViewProps.extend({
        init: function(parent, props) {
            this._super(parent, props);
            this.hideTab = true;
            this.viewPropsView = [];
        },
    });

    var ActivityEditView = baseEdit.ViewContent.extend({
        template: 'ViewStudio.View.activity',
        init: function(parent, params) {
            this._super(parent, params);
            this.viewConfig.prop = ActivityProps;
            this.viewConfig.view = ActivityViewEdit;
        },
    });

    return ActivityEditView;

});
