odoo.define('view_center.menu', function (require) {
    "use strict";

    var core = require('web.core');
    var Menu = require('web.Menu');
    var Dialog = require('web.Dialog');
    var QWeb = core.qweb;
    var basic_fields = require('dynamic_odoo.basic_fields');
    var base = require('dynamic_odoo.base');
    var view_dialogs = require('web.view_dialogs');
    const session = require('web.session');
    var FormViewDialog = view_dialogs.FormViewDialog;
    var SysTrayMenu = require('web.SystrayMenu');
    var _t = core._t;

    var StudioResource = base.WidgetBase.extend({
        init: function (parent, params = {}) {
            this._super(parent, params);
        },
        start: async function () {
            const fieldWidgets = await this.getReportFieldWidget();
            // const groups = await this.getGroups();
            odoo.studio.fieldWidgetOptions = fieldWidgets;
            odoo.studio.models = await this.getModels();
            odoo.studio.views = await this.getViews();
            // odoo.studio.groups = groups;
        },
        // getGroups: function () {
        //     return this['_rpc']({
        //         model: "res.groups",
        //         method: 'search_read',
        //         fields: ['id', 'display_name'],
        //         domain: [],
        //     });
        // },
        getViews: async function () {
            const views = await this['_rpc']({
                model: "ir.ui.view",
                method: 'get_views',
                fields: [],
                domain: []
            });
            return views;
        },
        getModels: async function () {
            const models = await this['_rpc']({
                model: "ir.model",
                method: 'search_read',
                fields: ['id', 'model', 'display_name'],
                domain: []
            }), prepareData = {};
            models.map((model) => {
                prepareData[model.model] = model;
            });
            return prepareData;
        },
        getReportFieldWidget: function () {
            return this['_rpc']({
                model: "report.center",
                method: 'get_field_widget',
                args: [],
                kwargs: {},
            });
        },
    });


    var StudioMode = base.WidgetBase.extend({
        template: "Studio.Icon",
        init: function (parent, params = {}) {
            this._super(parent, params);
        },
        renderMoreViews: function (e) {
            e.stopPropagation();
            e.stopImmediatePropagation();
            odoo.studio = {};
            (new StudioResource(this, {})).start();
            this.trigger_up("onShowStudioMode", {});
        },
        bindAction: function () {
            this._super();
            this.$el.click(this.renderMoreViews.bind(this));
        }
    });

    if (session['showStudio']) {
        StudioMode.prototype.sequence = 1;
        SysTrayMenu.Items.push(StudioMode);
    }


    var MenuCreator = base.WidgetBase.extend({
        template: "ViewStudio.MenuCreator",
        init: function (parent, params) {
            this._super(parent, params);
            this.fields = {};
            this.fields.empty_view = {label: "Use empty view", name: "empty_view", widget: basic_fields.Radio};
            this.fields.object_name = {
                label: "Choose menu name", name: "object_name",
                required: true, placeholder: "e.g. Props", widget: basic_fields.Input
            };
            this.fields.model_name = {
                label: "Choose object name", name: "model_name",
                required: true, placeholder: "e.g. x_model_demo", widget: basic_fields.Input
            };
            this.fields.model_id = {
                name: "model_id",
                label: "Choose Model",
                widget: basic_fields.FieldMany2one,
                propChange: this.onChangeModel.bind(this),
                required: true,
                props: {model: "no", relation: "ir.model", domain: []}
            };
            this.fields.new_model = {
                label: "New Model", name: "new_model", widget: basic_fields.ToggleSwitch, reload: true,
                propChange: this.onChangeIsNew.bind(this), value: true
            };
            this.fields.name = {
                label: "Menu", name: "name",
                required: true, placeholder: "e.g. Props", widget: basic_fields.Input
            };
            this.fields.groups_id = {label: "Groups", name: "groups_id", no_xml: true, widget: basic_fields.Groups};
            this.views = this.getView();
            this.prepareValue();
        },
        prepareValue: function () {
            const {value} = this.props;
            if (!value) return;
            Object.keys(value).map((fieldName) => {
                if (fieldName in this.fields) {
                    this.fields[fieldName].value = value[fieldName];
                }
            });
        },
        getView: function () {
            const {edit} = this.props;
            return edit ? ["name", "groups_id"] : ["object_name", "new_model", "model_name"];
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
            return this['_rpc']({
                model: "ir.ui.menu",
                method: 'create_new_menu',
                args: [values],
                kwargs: {},
            });
        },
        onUpdate: function (values) {
            const {menuId} = this.props;
            return this['_rpc']({
                model: "ir.ui.menu",
                method: 'write',
                args: [menuId, values],
                kwargs: {},
            });
        },
        onAction: function (values = {}) {
            const {edit} = this.props, data = Object.assign({}, values, this.getData());
            return edit ? this.onUpdate(data) : this.onCreate(data);
        },
        onFinish: function (e) {
            e.stopPropagation();
            this.onAction();
        },
        bindAction: function () {
            this._super();
            this.$el.find(".nFinish").click(this.onFinish.bind(this));
        },
        renderView: function () {
            const elWrap = this.$el.find(".wCon").empty();
            this.views.map((fieldName) => {
                const field = this.fields[fieldName],
                    fieldWidget = new field.widget(this, {
                        ...field, ...(field.props || {}),
                        onChange: (value) => this.onChangeInfo(field, value)
                    });
                fieldWidget.appendTo(elWrap);
            });
        }
    });

    var MenuEditor = base.WidgetBase.extend({
        template: "menu.edit",
        init: function (parent, params) {
            this._super(parent, params);
            this.menuObj = {};
            this.menuDelete = [];
            this.menuUpdate = {};
            this.state = {menuId: false};
        },
        prepareMenuData: function () {
            const data = {}, {menuId} = this.state;
            if (menuId) {
                const menuData = this.menuObj[menuId], {sequence, parent_id} = menuData;
                data.parent_id = parent_id ? parent_id[0] : false;
                data.sequence = sequence + 1;
            }
            return data;
        },
        getMenuId: function (el) {
            return parseInt(String(el.closest('li').data("menu-id") || 0));
        },
        onSave: async function () {
            await this['_rpc']({
                model: 'ir.ui.menu',
                method: 'update_menu',
                args: [this.menuUpdate, this.menuDelete],
            });
            this.reload_menu();
        },
        reload_menu: function () {
            const self = this, parent = self.parent.getParent(), {current_primary_menu} = this.props;
            parent.instanciate_menu_widgets().then(() => {
                parent.oldEdit = self.ref.sortable;
                core.bus.trigger('change_menu_section', current_primary_menu);
            });
        },
        onXpath: function (menu, menu_xpath, parent_xpath, position = "after") {
            const self = this, parent_menu = this.menuObj[menu.parent_id[0]];
            const menuIdx = parent_menu.children.findIndex((mn) => mn.id == menu.id);
            parent_menu.children.splice(menuIdx, 1);
            if (position == "append") {
                parent_xpath.children.push(menu);
            } else if (menu_xpath) {
                var xpathIndex = parent_xpath.children.findIndex((mn) => mn.id == menu_xpath.id);
                xpathIndex = position == "before" ? xpathIndex : xpathIndex + 1;
                parent_xpath.children.splice(xpathIndex, 0, menu);
                parent_xpath.children.map((mn, idx) => {
                    mn.sequence = idx;
                    const up = self.menuUpdate[mn.id] || {};
                    up.sequence = mn.sequence;
                    self.menuUpdate[mn.id] = up;
                });
            }
            menu.parent_id = [parent_xpath.id, parent_xpath.name];
            self.menuUpdate[menu.id] = {sequence: menu.sequence, parent_id: parent_xpath.id};
        },
        onStopSort: function (event, ui) {
            const getMenuId = (el) => this.menuObj[el.data("menu-id")];
            var item = ui.item, menu = getMenuId(item), menu_xpath = null, position = "before", parentMenu = null;
            const parent_id = item.attr("parent_id");
            if (parent_id) {
                parentMenu = this.menuObj[parent_id];
                position = "append";
            } else {
                parentMenu = getMenuId(item.parent());
                menu_xpath = item.next();
                if (!menu_xpath.length && item.prev().length) {
                    menu_xpath = item.prev();
                    position = "after";
                }
                menu_xpath.length ? menu_xpath = getMenuId(menu_xpath) : (position = "append");
            }
            this.onXpath(menu, menu_xpath, parentMenu, position);
            this.renderSortable();
        },
        prevMenu: function (el) {
            var prev = el.prev();
            if (prev.hasClass("ui-sortable-helper")) {
                prev = prev.prev();
            }
            return prev;
        },
        _clearCh: function (ui) {
            ui.placeholder.removeClass("aCh");
            ui.item.removeAttr("parent_id");
        },
        _addCh: function (ui, prev) {
            ui.placeholder.addClass("aCh");
            ui.item.attr("parent_id", prev.data("menu-id"));
        },
        onSortSort: function (event, ui) {
            const {placeholder, item} = ui, prev = this.prevMenu(placeholder);
            const prevPos = prev.position(), itemPos = item.position();
            if (!prev.length || !((itemPos.left - prevPos.left) > 30)) {
                return this._clearCh(ui);
            }
            this._addCh(ui, prev);
        },
        onChangeSort: function (event, ui) {
            const {left} = ui.placeholder.position(), prev = this.prevMenu(ui.placeholder);
            if (prev.length && left > 60) {
                this._addCh(ui, prev);
            }
        },
        onOverSort: function (event, ui) {
            ui.placeholder.addClass("dragging");
        },
        bindSortable: function () {
            if (this.ref.sortable) {
                const self = this, params = {
                    connectWith: "._wrapUlEdit",
                    sort: function (event, ui) {
                        self.onSortSort(event, ui);
                    },
                    over: function (event, ui) {
                        self.onOverSort(event, ui);
                    },
                    stop: function (event, ui) {
                        self.onStopSort(event, ui);
                    },
                    change: function (event, ui) {
                        self.onChangeSort(event, ui);
                    }
                }
                this.ref.sortable.find('._con > ._wrapUlEdit ._wrapUlEdit').sortable(params);
            }
        },
        renderSortable: function () {
            const {current_primary_menu, menu_data} = this.props;
            if (this.ref.sortable) {
                this.ref.sortable.remove();
            }
            const renderParams = {
                widget: this, menus: Object.values(menu_data.children).filter((menu) => menu.id == current_primary_menu)
            }
            this.ref.sortable = $(QWeb.render("menu.SortEdit", renderParams));
            $('body').append(this.ref.sortable);
            this.bindSortable();
            this.bindAction();
        },
        // destroy: function () {
        //     this.$el.remove();
        //     this.ref.sortable.remove();
        // },
        onClose: function () {
            this.ref.sortable.remove();
        },
        onEditMenu: async function (e) {
            e.stopPropagation();
            e.stopImmediatePropagation();
            const menuId = this.getMenuId($(e.currentTarget));
            var menu = await this['_rpc']({
                model: "ir.ui.menu",
                method: "search_read",
                domain: [['id', '=', menuId]]
            });
            if (menu.length) {
                menu = menu[0];
                this.onMenuCreator({edit: true, menuId: menuId, value: {name: menu.name, groups_id: menu.groups_id}});
            }
        },
        onRemoveMenu: function (e) {
            const self = this;
            Dialog.studioConfirm(this, _t("Are you sure that you want to delete this menu ?"), {
                confirm_callback: async () => {
                    const line = $(e.currentTarget).closest("li"), menuId = parseInt(line.first().data("menu-id"));
                    delete self.menuUpdate[menuId];
                    self.menuDelete.push(menuId);
                    line.remove();
                },
                cancel_callback: async () => {
                }
            });
        },
        onCreateMenu: function (e) {
            e.stopPropagation();
            e.stopImmediatePropagation();
            this.state.menuId = this.getMenuId($(e.currentTarget));
            this.onMenuCreator();
        },
        onMenuCreator: function (params = {}) {
            const self = this, elWrap = $("<div>"), menuCreator = new MenuCreator(this, params);
            menuCreator.appendTo(elWrap);
            this.$dialog = new Dialog(this, {
                buttons: [
                    {
                        text: _t("Cancel"),
                        classes: 'btn',
                        close: true,
                    },
                    {
                        text: _t("Save"),
                        classes: 'btn-primary',
                        close: true,
                        click: async (e) => {
                            e.stopPropagation();
                            const {current_primary_menu} = self.props,
                                data = await menuCreator.onAction(params.edit ? {} : self.prepareMenuData());
                            if (params.edit) return self.reload_menu();
                            if (data && !params.edit) {
                                self.trigger_up('onShowNewMenu', Object.assign(data || {}, {current_primary_menu: current_primary_menu}));
                                self.ref.sortable.remove();
                            }
                        },
                    },
                ],
                $content: elWrap,
                size: 'medium',
                studio: true,
                classes: "dialogOptions",
                title: _t("Options Center"),
            }).open();
        },
        bindAction: function () {
            const {sortable} = this.ref;
            if (sortable) {
                sortable.find("._aClose").click(this.onClose.bind(this));
                sortable.find(".faEdit").click(this.onEditMenu.bind(this));
                sortable.find(".faRemove").click(this.onRemoveMenu.bind(this));
                sortable.find("._wAdd").click(this.onCreateMenu.bind(this));
                sortable.find("._btnConfirm").click(this.onSave.bind(this));
            }
            this.$el.find("._menuEdit").unbind('click').click(this.renderSortable.bind(this));
        }
    });

    Menu.include({
        change_menu_section: function (primary_menu_id) {
            this._super(primary_menu_id);
            this.$el.find("._menuEdit").remove();
            const menuEdit = new MenuEditor(this, {
                menu_data: this.menu_data,
                current_primary_menu: this.current_primary_menu
            }), parent = this.getParent();
            menuEdit.renderElement();
            this.$section_placeholder.find('li:last-child').after(menuEdit.$el);
            if (parent.oldEdit) {
                parent.oldEdit.remove();
                menuEdit.renderSortable();
                delete parent.oldEdit;
            }
        },
    });

    return Menu;

})
;
