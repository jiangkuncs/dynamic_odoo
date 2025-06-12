odoo.define('dynamic_odoo.GraphView', function (require) {
"use strict";

    var GraphView = require('web.GraphView');

    GraphView.include({
        init: function (viewInfo, params) {
            this._super.apply(this, arguments);
            this.loadParams.stacked = ["True", "true", true, "1"].includes(this.arch.attrs.stacked);
        },
    });
});
