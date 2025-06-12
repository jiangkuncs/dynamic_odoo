odoo.define('dynamic_odoo.odoo_basic_fields', function (require) {
    "use strict";

    var core = require('web.core');
    var Domain = require('web.Domain');
    var AbstractField = require('web.AbstractField');

    AbstractField.include({
        init: function (parent, name, record, options) {
            this._super(parent, name, record, options);
            if (this.field && this.field.type == "selection" && this.attrs.selection) {
                this.field.selection = JSON.parse(this.attrs.selection);
            }
        },
        // _widgetRenderAndInsert: function (insertion, target) {
        //     if (this.field.type == "selection" && this.__node) {
        //         const {selection} = this.__node.attrs;
        //         if (selection) {
        //             this.field.selection = JSON.parse(selection);
        //         }
        //     }
        //     return this._super(insertion, target);
        // }
    });

});
