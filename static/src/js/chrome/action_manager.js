odoo.define('dynamic_odoo.ActionManager', function (require) {

    var DataManager = require("web.DataManager");

    DataManager.include({
        load_views: function (params, options) {
            const {action_id} = options || {}, state = $.bbq.getState(true);
            if (!params.context) {
                params.context = {};
            }
            // 修改穿透查询报“Error: val is undefined”错误----by huchuanwei 20230316
            if (action_id || state.action !== undefined){
                params.context.action = action_id || state.action;
            }
            // params.context.action = action_id || state.action;
            // 修改穿透查询报“Error: val is undefined”错误----by huchuanwei 20230316
            return this._super(params, options);
        },
        load_action: function (action_id, additional_context) {
            if (!additional_context) {
                additional_context = {};
            }
            if (action_id) {
                additional_context.action_id = action_id;
            }
            return this._super(action_id, additional_context);
        }
    });
});
