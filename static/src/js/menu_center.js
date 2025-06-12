odoo.define('dynamic_odoo.AppCenter', function (require) {
    "use strict";

    var core = require('web.core');
    var base = require('dynamic_odoo.base');
    var basic_fields = require('dynamic_odoo.basic_fields');


    var MenuCreator = base.WidgetBase.extend({
        template: "ViewStudio.MenuCreator",
        init: function (parent, params) {
            this._super(parent, params);
            this.fields = {};
            this.fields.empty_view = {label: "Use empty view", name: "empty_view", widget: basic_fields.Radio};
            this.fields.object_name = {label: "Choose menu name", name: "object_name",
                required: true, placeholder: "e.g. Props", widget: basic_fields.Input};
            this.fields.model_name = {label: "Choose object name", name: "model_name",
                required: true, placeholder: "e.g. x_model_demo", widget: basic_fields.Input};
            this.fields.model_id = {name: "model_id", label: "Choose Model", widget: basic_fields.FieldMany2one, propChange: this.onChangeModel.bind(this),
                required: true, props: {model: "no", relation: "ir.model", domain: []}};
            this.fields.new_model = {label: "New Model", name: "new_model", widget: basic_fields.ToggleSwitch, reload: true,
                propChange: this.onChangeIsNew.bind(this), value: true};

            this.views = ["object_name", "new_model", "model_name"];
        },
        getData: function () {
            const data = {};
            this.views.map((fieldName) => {
                const field = this.fields[fieldName];
                data[fieldName] = field.value;
            });
            return data;
        },
        onChangeModel: function (field, value) {
            field.value = value.id;
        },
        onChangeIsNew: function (field, value) {
            value ? this.views.splice(2, 2, "model_name") : this.views.splice(2, 1, ...["empty_view", "model_id"]);
            field.value = value;
        },
        onChangeInfo: function (field, value) {
            if (field.propChange) {
                field.propChange(field, value);
            } else {
                field.value = value;
            }
            if (field.reload) {
                this.renderView();
            }
        },
        onCreate: function (values) {
            values = Object.assign(values, this.getData());
            return this['_rpc']({
                model: "ir.ui.menu",
                method: 'create_new_menu',
                args: [values],
                kwargs: {},
            });
        },
        onFinish: function (e) {
            e.stopPropagation();
            this.onCreate();
        },
        bindAction: function () {
            this._super();
            this.$el.find(".nFinish").click(this.onFinish.bind(this));
        },
        renderView: function () {
            const elWrap = this.$el.find(".wCon").empty();
            this.views.map((fieldName) => {
                const field = this.fields[fieldName],
                    fieldWidget = new field.widget(this, {...field, ...(field.props || {}),
                        onChange: (value) => this.onChangeInfo(field, value)});
                fieldWidget.appendTo(elWrap);
            });
        }
    });

    return MenuCreator;
});
