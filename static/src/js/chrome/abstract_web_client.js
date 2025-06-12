odoo.define('dynamic_odoo.AbstractWebClient', function (require) {
"use strict";

    var core = require('web.core');
    var WebClient = require('web.WebClient');
    var ViewControl = require("dynamic_odoo.ViewsCenter");


    WebClient.include({
        custom_events: _.extend({}, WebClient.prototype.custom_events, {
            onShowStudioMode: 'showStudioMode',
            onShowNewMenu: 'onShowNewMenu',
            onShowNewApp: 'onShowNewApp',
        }),
        showStudioMode: function () {
            const {view_type} = $.bbq.getState(), viewControl = new ViewControl(this.action_manager,
                {step: 'setup', typeEdit: "views", title: "Columns Setup", viewType: view_type});
            viewControl.appendTo($("body"));
            $('body').addClass("editMode");
            this.studioInstance = viewControl;
        },
        onShowNewApp: function (ev) {
            const self = this, {menu_id, action_id} = ev.data;
            this.instanciate_menu_widgets().then(() => {
                const appsMenu = self.menu._appsMenu;
                const app = _.findWhere(appsMenu._apps, { actionID: action_id, menuID: menu_id });
                appsMenu._openApp(app);
            });
        },
        onShowNewMenu: function (ev) {
            const self = this, {menu_id, current_primary_menu, action_id} = ev.data;
            this.instanciate_menu_widgets().then(() => {
                core.bus.trigger('change_menu_section', current_primary_menu);
                self.menu._on_secondary_menu_click(menu_id, action_id);
            });
        },
        on_menu_clicked: function (ev) {
            if (this.studioInstance) {
                this.reloadStudio = true;
            }
            this._super(ev);
        },
        on_app_clicked: function (ev) {
            if (this.studioInstance) {
                this.reloadStudio = true;
            }
            return this._super(ev);
        },
        do_push_state: function (state) {
            this._super(state);
            if (this.studioInstance && this.reloadStudio) {
                delete this.reloadStudio;
                this.studioInstance.onPushState(state);
            }
        },
    });
});
