"use strict";
// gridstack.ts 3.1.3 @preserve
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * https://gridstackjs.com/
 * (c) 2014-2020 Alain Dumesny, Dylan Weiss, Pavel Reznikov
 * gridstack.js may be freely distributed under the MIT license.
*/
const gridstack_engine_1 = require("./gridstack-engine");
const utils_1 = require("./utils");
const gridstack_ddi_1 = require("./gridstack-ddi");
__export(require("./utils"));
__export(require("./gridstack-engine"));
__export(require("./gridstack-ddi"));
// default values for grid options - used during init and when saving out
const GridDefaults = {
    column: 12,
    minRow: 0,
    maxRow: 0,
    itemClass: 'grid-stack-item',
    placeholderClass: 'grid-stack-placeholder',
    placeholderText: '',
    handle: '.grid-stack-item-content',
    handleClass: null,
    styleInHead: false,
    cellHeight: 'auto',
    margin: 10,
    auto: true,
    minWidth: 768,
    float: false,
    staticGrid: false,
    animate: true,
    alwaysShowResizeHandle: false,
    resizable: {
        autoHide: true,
        handles: 'se'
    },
    draggable: {
        handle: '.grid-stack-item-content',
        scroll: false,
        appendTo: 'body'
    },
    dragIn: undefined,
    dragInOptions: {
        revert: 'invalid',
        handle: '.grid-stack-item-content',
        scroll: false,
        appendTo: 'body'
    },
    disableDrag: false,
    disableResize: false,
    rtl: 'auto',
    removable: false,
    removableOptions: {
        accept: '.grid-stack-item'
    },
    removeTimeout: 2000,
    marginUnit: 'px',
    cellHeightUnit: 'px',
    disableOneColumnMode: false,
    oneColumnModeDomSort: false
};
/**
 * Main gridstack class - you will need to call `GridStack.init()` first to initialize your grid.
 * Note: your grid elements MUST have the following classes for the CSS layout to work:
 * @example
 * <div class="grid-stack">
 *   <div class="grid-stack-item">
 *     <div class="grid-stack-item-content">Item 1</div>
 *   </div>
 * </div>
 */
class GridStack {
    /**
     * Construct a grid item from the given element and options
     * @param el
     * @param opts
     */
    constructor(el, opts = {}) {
        /** @internal */
        this._gsEventHandler = {};
        this.el = el; // exposed HTML element to the user
        opts = opts || {}; // handles null/undefined/0
        utils_1.obsoleteOpts(opts, 'verticalMargin', 'margin', 'v2.0');
        utils_1.obsoleteAttr(this.el, 'data-gs-current-height', 'gs-current-row', 'v1.0.0');
        // if row property exists, replace minRow and maxRow instead
        if (opts.row) {
            opts.minRow = opts.maxRow = opts.row;
            delete opts.row;
        }
        let rowAttr = utils_1.Utils.toNumber(el.getAttribute('gs-row'));
        // elements attributes override any passed options (like CSS style) - merge the two together
        let defaults = Object.assign(Object.assign({}, GridDefaults), { column: utils_1.Utils.toNumber(el.getAttribute('gs-column')) || 12, minRow: rowAttr ? rowAttr : utils_1.Utils.toNumber(el.getAttribute('gs-min-row')) || 0, maxRow: rowAttr ? rowAttr : utils_1.Utils.toNumber(el.getAttribute('gs-max-row')) || 0, staticGrid: utils_1.Utils.toBool(el.getAttribute('gs-static')) || false, _styleSheetClass: 'grid-stack-instance-' + (Math.random() * 10000).toFixed(0), alwaysShowResizeHandle: opts.alwaysShowResizeHandle || false, resizable: {
                autoHide: !(opts.alwaysShowResizeHandle || false),
                handles: 'se'
            }, draggable: {
                handle: (opts.handleClass ? '.' + opts.handleClass : (opts.handle ? opts.handle : '')) || '.grid-stack-item-content',
                scroll: false,
                appendTo: 'body'
            }, removableOptions: {
                accept: '.' + (opts.itemClass || 'grid-stack-item')
            } });
        if (el.getAttribute('gs-animate')) { // default to true, but if set to false use that instead
            defaults.animate = utils_1.Utils.toBool(el.getAttribute('gs-animate'));
        }
        this.opts = utils_1.Utils.defaults(opts, defaults);
        opts = null; // make sure we use this.opts instead
        this.initMargin();
        if (this.opts.rtl === 'auto') {
            this.opts.rtl = el.style.direction === 'rtl';
        }
        if (this.opts.rtl) {
            this.el.classList.add('grid-stack-rtl');
        }
        // check if we're been nested, and if so update our style and keep pointer around (used during save)
        let parentGridItemEl = utils_1.Utils.closestByClass(this.el, GridDefaults.itemClass);
        if (parentGridItemEl && parentGridItemEl.gridstackNode) {
            this.opts._isNested = parentGridItemEl.gridstackNode;
            this.opts._isNested.subGrid = this;
            this.el.classList.add('grid-stack-nested');
        }
        this._isAutoCellHeight = (this.opts.cellHeight === 'auto');
        if (this._isAutoCellHeight) {
            // make the cell content square initially (will use resize event to keep it square)
            let marginDiff = -this.opts.marginRight - this.opts.marginLeft
                + this.opts.marginTop + this.opts.marginBottom;
            this.cellHeight(this.cellWidth() + marginDiff, false);
        }
        else {
            this.cellHeight(this.opts.cellHeight, false);
        }
        this.el.classList.add(this.opts._styleSheetClass);
        this._setStaticClass();
        this.engine = new gridstack_engine_1.GridStackEngine({
            column: this.opts.column,
            float: this.opts.float,
            maxRow: this.opts.maxRow,
            onChange: (cbNodes, removeDOM = true) => {
                let maxH = 0;
                this.engine.nodes.forEach(n => { maxH = Math.max(maxH, n.y + n.h); });
                cbNodes.forEach(n => {
                    let el = n.el;
                    if (removeDOM && n._id === null) {
                        if (el && el.parentNode) {
                            el.parentNode.removeChild(el);
                        }
                    }
                    else {
                        this._writePosAttr(el, n.x, n.y, n.w, n.h);
                    }
                });
                this._updateStyles(false, maxH); // false = don't recreate, just append if need be
            }
        });
        if (this.opts.auto) {
            this.batchUpdate(); // prevent in between re-layout #1535 TODO: this only set float=true, need to prevent collision check...
            let elements = [];
            this.getGridItems().forEach(el => {
                let x = parseInt(el.getAttribute('gs-x'));
                let y = parseInt(el.getAttribute('gs-y'));
                elements.push({
                    el,
                    // if x,y are missing (autoPosition) add them to end of list - but keep their respective DOM order
                    i: (Number.isNaN(x) ? 1000 : x) + (Number.isNaN(y) ? 1000 : y) * this.opts.column
                });
            });
            elements.sort(e => e.i).forEach(e => this._prepareElement(e.el));
            this.commit();
        }
        this.engine.saveInitial(); // initial start of items
        this.setAnimation(this.opts.animate);
        let placeholderChild = document.createElement('div');
        placeholderChild.className = 'placeholder-content';
        placeholderChild.innerHTML = this.opts.placeholderText;
        this.placeholder = document.createElement('div');
        this.placeholder.classList.add(this.opts.placeholderClass, defaults.itemClass, this.opts.itemClass);
        this.placeholder.appendChild(placeholderChild);
        this._updateStyles();
        this._setupDragIn();
        this._setupRemoveDrop();
        this._setupAcceptWidget();
        this._updateWindowResizeEvent(); // finally this may size us down to 1 column
    }
    /**
     * initializing the HTML element, or selector string, into a grid will return the grid. Calling it again will
     * simply return the existing instance (ignore any passed options). There is also an initAll() version that support
     * multiple grids initialization at once. Or you can use addGrid() to create the entire grid from JSON.
     * @param options grid options (optional)
     * @param elOrString element or CSS selector (first one used) to convert to a grid (default to '.grid-stack' class selector)
     *
     * @example
     * let grid = GridStack.init();
     *
     * Note: the HTMLElement (of type GridHTMLElement) will store a `gridstack: GridStack` value that can be retrieve later
     * let grid = document.querySelector('.grid-stack').gridstack;
     */
    static init(options = {}, elOrString = '.grid-stack') {
        let el = GridStack.getGridElement(elOrString);
        if (!el) {
            if (typeof elOrString === 'string') {
                console.error('GridStack.initAll() no grid was found with selector "' + elOrString + '" - element missing or wrong selector ?' +
                    '\nNote: ".grid-stack" is required for proper CSS styling and drag/drop, and is the default selector.');
            }
            else {
                console.error('GridStack.init() no grid element was passed.');
            }
            return null;
        }
        if (!el.gridstack) {
            el.gridstack = new GridStack(el, Object.assign({}, options));
        }
        return el.gridstack;
    }
    /**
     * Will initialize a list of elements (given a selector) and return an array of grids.
     * @param options grid options (optional)
     * @param selector elements selector to convert to grids (default to '.grid-stack' class selector)
     *
     * @example
     * let grids = GridStack.initAll();
     * grids.forEach(...)
     */
    static initAll(options = {}, selector = '.grid-stack') {
        let grids = [];
        GridStack.getGridElements(selector).forEach(el => {
            if (!el.gridstack) {
                el.gridstack = new GridStack(el, Object.assign({}, options));
            }
            grids.push(el.gridstack);
        });
        if (grids.length === 0) {
            console.error('GridStack.initAll() no grid was found with selector "' + selector + '" - element missing or wrong selector ?' +
                '\nNote: ".grid-stack" is required for proper CSS styling and drag/drop, and is the default selector.');
        }
        return grids;
    }
    /**
     * call to create a grid with the given options, including loading any children from JSON structure. This will call GridStack.init(), then
     * grid.load() on any passed children (recursively). Great alternative to calling init() if you want entire grid to come from
     * JSON serialized data, including options.
     * @param parent HTML element parent to the grid
     * @param opt grids options used to initialize the grid, and list of children
     */
    static addGrid(parent, opt = {}) {
        if (!parent) {
            return null;
        }
        // create the grid element
        let doc = document.implementation.createHTMLDocument();
        doc.body.innerHTML = `<div class="grid-stack ${opt.class || ''}"></div>`;
        let el = doc.body.children[0];
        parent.append(el);
        // create grid class and load any children
        let grid = GridStack.init(opt, el);
        if (opt.children) {
            grid.load(opt.children);
        }
        return grid;
    }
    /**
     * add a new widget and returns it.
     *
     * Widget will be always placed even if result height is more than actual grid height.
     * You need to use `willItFit()` before calling addWidget for additional check.
     * See also `makeWidget()`.
     *
     * @example
     * let grid = GridStack.init();
     * grid.addWidget({w: 3, content: 'hello'});
     * grid.addWidget('<div class="grid-stack-item"><div class="grid-stack-item-content">hello</div></div>', {w: 3});
     *
     * @param el  GridStackWidget (which can have content string as well), html element, or string definition to add
     * @param options widget position/size options (optional, and ignore if first param is already option) - see GridStackWidget
     */
    addWidget(els, options) {
        // support legacy call for now ?
        if (arguments.length > 2) {
            console.warn('gridstack.ts: `addWidget(el, x, y, width...)` is deprecated. Use `addWidget({x, y, w, content, ...})`. It will be removed soon');
            // eslint-disable-next-line prefer-rest-params
            let a = arguments, i = 1, opt = { x: a[i++], y: a[i++], w: a[i++], h: a[i++], autoPosition: a[i++],
                minW: a[i++], maxW: a[i++], minH: a[i++], maxH: a[i++], id: a[i++] };
            return this.addWidget(els, opt);
        }
        function isGridStackWidget(w) {
            return w.x !== undefined || w.y !== undefined || w.w !== undefined || w.h !== undefined || w.content !== undefined ? true : false;
        }
        let el;
        if (typeof els === 'string') {
            let doc = document.implementation.createHTMLDocument();
            doc.body.innerHTML = els;
            el = doc.body.children[0];
        }
        else if (arguments.length === 0 || arguments.length === 1 && isGridStackWidget(els)) {
            let content = els ? els.content || '' : '';
            options = els;
            let doc = document.implementation.createHTMLDocument();
            doc.body.innerHTML = `<div class="grid-stack-item ${this.opts.itemClass || ''}"><div class="grid-stack-item-content">${content}</div></div>`;
            el = doc.body.children[0];
        }
        else {
            el = els;
        }
        // Tempting to initialize the passed in opt with default and valid values, but this break knockout demos
        // as the actual value are filled in when _prepareElement() calls el.getAttribute('gs-xyz) before adding the node.
        // So make sure we load any DOM attributes that are not specified in passed in options (which override)
        let domAttr = this._readAttr(el);
        options = Object.assign({}, (options || {})); // make a copy before we modify in case caller re-uses it
        utils_1.Utils.defaults(options, domAttr);
        this.engine.prepareNode(options);
        this._writeAttr(el, options);
        if (this._insertNotAppend) {
            this.el.prepend(el);
        }
        else {
            this.el.appendChild(el);
        }
        // similar to makeWidget() that doesn't read attr again and worse re-create a new node and loose any _id
        this._prepareElement(el, true, options);
        this._updateContainerHeight();
        this._triggerAddEvent();
        this._triggerChangeEvent();
        return el;
    }
    /**
     * saves the current layout returning a list of widgets for serialization (with default to save content), which might include any nested grids.
     * Optionally you can also save the grid with options itself, so you can call the new GridStack.addGrid()
     * to recreate everything from scratch. GridStackOptions.children would then contain the widget list.
     */
    save(saveContent = true, saveGridOpt = false) {
        // return copied nodes we can modify at will...
        let list = this.engine.save(saveContent);
        // check for HTML content as well
        if (saveContent) {
            list.forEach(n => {
                if (n.el) {
                    let sub = n.el.querySelector('.grid-stack-item-content');
                    n.content = sub ? sub.innerHTML : undefined;
                    if (!n.content)
                        delete n.content;
                    delete n.el;
                }
            });
        }
        // check if save entire grid options (needed for recursive) + children...
        if (saveGridOpt) {
            // check for nested grid
            list.forEach(n => {
                if (n.subGrid) {
                    n.subGrid = n.subGrid.save(saveContent, true);
                }
            });
            let o = Object.assign({}, this.opts);
            // delete default values that will be recreated on launch
            if (o.marginBottom === o.marginTop && o.marginRight === o.marginLeft && o.marginTop === o.marginRight) {
                o.margin = o.marginTop;
                delete o.marginTop;
                delete o.marginRight;
                delete o.marginBottom;
                delete o.marginLeft;
            }
            if (o.rtl === (this.el.style.direction === 'rtl')) {
                o.rtl = 'auto';
            }
            if (this._isAutoCellHeight) {
                o.cellHeight = 'auto';
            }
            utils_1.Utils.removeInternalAndSame(o, GridDefaults);
            o.children = list;
            return o;
        }
        return list;
    }
    /**
     * load the widgets from a list. This will call update() on each (matching by id) or add/remove widgets that are not there.
     *
     * @param layout list of widgets definition to update/create
     * @param addAndRemove boolean (default true) or callback method can be passed to control if and how missing widgets can be added/removed, giving
     * the user control of insertion.
     *
     * @example
     * see http://gridstackjs.com/demo/serialization.html
     **/
    load(layout, addAndRemove = true) {
        let items = GridStack.Utils.sort(layout, -1, this._prevColumn || this.opts.column);
        this._insertNotAppend = true; // since create in reverse order...
        // if we're loading a layout into 1 column (_prevColumn is set only when going to 1) and items don't fit, make sure to save
        // the original wanted layout so we can scale back up correctly #1471
        if (this._prevColumn && this._prevColumn !== this.opts.column && items.some(n => (n.x + n.w) > this.opts.column)) {
            this._ignoreLayoutsNodeChange = true; // skip layout update
            this.engine.cacheLayout(items, this._prevColumn, true);
        }
        let removed = [];
        this.batchUpdate();
        // see if any items are missing from new layout and need to be removed first
        if (addAndRemove) {
            let copyNodes = [...this.engine.nodes]; // don't loop through array you modify
            copyNodes.forEach(n => {
                let item = items.find(w => n.id === w.id);
                if (!item) {
                    if (typeof (addAndRemove) === 'function') {
                        addAndRemove(this, n, false);
                    }
                    else {
                        removed.push(n); // batch keep track
                        this.removeWidget(n.el, true, false);
                    }
                }
            });
        }
        // now add/update the widgets
        items.forEach(w => {
            let item = (w.id || w.id === 0) ? this.engine.nodes.find(n => n.id === w.id) : undefined;
            if (item) {
                this.update(item.el, w);
                if (w.subGrid && w.subGrid.children) { // update any sub grid as well
                    let sub = item.el.querySelector('.grid-stack');
                    if (sub && sub.gridstack) {
                        sub.gridstack.load(w.subGrid.children); // TODO: support updating grid options ?
                        this._insertNotAppend = true; // got reset by above call
                    }
                }
            }
            else if (addAndRemove) {
                if (typeof (addAndRemove) === 'function') {
                    w = addAndRemove(this, w, true).gridstackNode;
                }
                else {
                    w = this.addWidget(w).gridstackNode;
                }
                if (w.subGrid) { // see if there is a sub-grid to create too
                    let content = w.el.querySelector('.grid-stack-item-content');
                    w.subGrid = GridStack.addGrid(content, w.subGrid);
                }
            }
        });
        this.engine.removedNodes = removed;
        this.commit();
        // after commit, clear that flag
        delete this._ignoreLayoutsNodeChange;
        delete this._insertNotAppend;
        return this;
    }
    /**
     * Initializes batch updates. You will see no changes until `commit()` method is called.
     */
    batchUpdate() {
        this.engine.batchUpdate();
        return this;
    }
    /**
     * Gets current cell height.
     */
    getCellHeight(forcePixel = false) {
        if (this.opts.cellHeight && this.opts.cellHeight !== 'auto' &&
            (!forcePixel || !this.opts.cellHeightUnit || this.opts.cellHeightUnit === 'px')) {
            return this.opts.cellHeight;
        }
        // else get first cell height
        // or do entire grid and # of rows ? (this.el.getBoundingClientRect().height) / parseInt(this.el.getAttribute('gs-current-row'))
        let el = this.el.querySelector('.' + this.opts.itemClass);
        let height = utils_1.Utils.toNumber(el.getAttribute('gs-h'));
        return Math.round(el.offsetHeight / height);
    }
    /**
     * Update current cell height - see `GridStackOptions.cellHeight` for format.
     * This method rebuilds an internal CSS style sheet.
     * Note: You can expect performance issues if call this method too often.
     *
     * @param val the cell height
     * @param update (Optional) if false, styles will not be updated
     *
     * @example
     * grid.cellHeight(grid.cellWidth() * 1.2);
     */
    cellHeight(val, update = true) {
        let data = utils_1.Utils.parseHeight(val);
        if (this.opts.cellHeightUnit === data.unit && this.opts.cellHeight === data.h) {
            return this;
        }
        this.opts.cellHeightUnit = data.unit;
        this.opts.cellHeight = data.h;
        if (update) {
            this._updateStyles(true); // true = force re-create
        }
        this._resizeNestedGrids(this.el);
        return this;
    }
    /**
     * Gets current cell width.
     */
    cellWidth() {
        // use parent width if we're 0 (no size yet)
        return (this.el.offsetWidth || this.el.parentElement.offsetWidth || window.innerWidth) / this.opts.column;
    }
    /**
     * Finishes batch updates. Updates DOM nodes. You must call it after batchUpdate.
     */
    commit() {
        this.engine.commit();
        this._triggerRemoveEvent();
        this._triggerAddEvent();
        this._triggerChangeEvent();
        return this;
    }
    /** re-layout grid items to reclaim any empty space */
    compact() {
        this.engine.compact();
        this._triggerChangeEvent();
        return this;
    }
    /**
     * set the number of columns in the grid. Will update existing widgets to conform to new number of columns,
     * as well as cache the original layout so you can revert back to previous positions without loss.
     * Requires `gridstack-extra.css` or `gridstack-extra.min.css` for [2-11],
     * else you will need to generate correct CSS (see https://github.com/gridstack/gridstack.js#change-grid-columns)
     * @param column - Integer > 0 (default 12).
     * @param layout specify the type of re-layout that will happen (position, size, etc...).
     * Note: items will never be outside of the current column boundaries. default (moveScale). Ignored for 1 column
     */
    column(column, layout = 'moveScale') {
        if (this.opts.column === column) {
            return this;
        }
        let oldColumn = this.opts.column;
        // if we go into 1 column mode (which happens if we're sized less than minW unless disableOneColumnMode is on)
        // then remember the original columns so we can restore.
        if (column === 1) {
            this._prevColumn = oldColumn;
        }
        else {
            delete this._prevColumn;
        }
        this.el.classList.remove('grid-stack-' + oldColumn);
        this.el.classList.add('grid-stack-' + column);
        this.opts.column = this.engine.column = column;
        // update the items now - see if the dom order nodes should be passed instead (else default to current list)
        let domNodes;
        if (column === 1 && this.opts.oneColumnModeDomSort) {
            domNodes = [];
            this.getGridItems().forEach(el => {
                if (el.gridstackNode) {
                    domNodes.push(el.gridstackNode);
                }
            });
            if (!domNodes.length) {
                domNodes = undefined;
            }
        }
        this.engine.updateNodeWidths(oldColumn, column, domNodes, layout);
        // and trigger our event last...
        this._ignoreLayoutsNodeChange = true; // skip layout update
        this._triggerChangeEvent();
        delete this._ignoreLayoutsNodeChange;
        return this;
    }
    /**
     * get the number of columns in the grid (default 12)
     */
    getColumn() {
        return this.opts.column;
    }
    /** returns an array of grid HTML elements (no placeholder) - used to iterate through our children */
    getGridItems() {
        return Array.from(this.el.children)
            .filter((el) => el.matches('.' + this.opts.itemClass) && !el.matches('.' + this.opts.placeholderClass));
    }
    /**
     * Destroys a grid instance. DO NOT CALL any methods or access any vars after this as it will free up members.
     * @param removeDOM if `false` grid and items HTML elements will not be removed from the DOM (Optional. Default `true`).
     */
    destroy(removeDOM = true) {
        if (!this.el) {
            return;
        } // prevent multiple calls
        this._updateWindowResizeEvent(true);
        this.setStatic(true); // permanently removes DD
        if (!removeDOM) {
            this.removeAll(removeDOM);
            this.el.classList.remove(this.opts._styleSheetClass);
        }
        else {
            this.el.parentNode.removeChild(this.el);
        }
        this._removeStylesheet();
        delete this.opts._isNested;
        delete this.opts;
        delete this.placeholder;
        delete this.engine;
        delete this.el.gridstack; // remove circular dependency that would prevent a freeing
        delete this.el;
        return this;
    }
    /**
     * Temporarily disables widgets moving/resizing.
     * If you want a more permanent way (which freezes up resources) use `setStatic(true)` instead.
     * Note: no-op for static grid
     * This is a shortcut for:
     * @example
     *  grid.enableMove(false);
     *  grid.enableResize(false);
     */
    disable() {
        if (this.opts.staticGrid) {
            return;
        }
        this.enableMove(false);
        this.enableResize(false);
        this._triggerEvent('disable');
        return this;
    }
    /**
     * Re-enables widgets moving/resizing - see disable().
     * Note: no-op for static grid.
     * This is a shortcut for:
     * @example
     *  grid.enableMove(true);
     *  grid.enableResize(true);
     */
    enable() {
        if (this.opts.staticGrid) {
            return;
        }
        this.enableMove(true);
        this.enableResize(true);
        this._triggerEvent('enable');
        return this;
    }
    /**
     * Enables/disables widget moving. No-op for static grids.
     *
     * @param doEnable
     * @param includeNewWidgets will force new widgets to be draggable as per
     * doEnable`s value by changing the disableDrag grid option (default: true).
     */
    enableMove(doEnable, includeNewWidgets = true) {
        if (this.opts.staticGrid) {
            return this;
        } // can't move a static grid!
        this.getGridItems().forEach(el => this.movable(el, doEnable));
        if (includeNewWidgets) {
            this.opts.disableDrag = !doEnable;
        }
        return this;
    }
    /**
     * Enables/disables widget resizing. No-op for static grids.
     * @param doEnable
     * @param includeNewWidgets will force new widgets to be draggable as per
     * doEnable`s value by changing the disableResize grid option (default: true).
     */
    enableResize(doEnable, includeNewWidgets = true) {
        if (this.opts.staticGrid) {
            return this;
        } // can't size a static grid!
        this.getGridItems().forEach(el => this.resizable(el, doEnable));
        if (includeNewWidgets) {
            this.opts.disableResize = !doEnable;
        }
        return this;
    }
    /**
     * enable/disable floating widgets (default: `false`) See [example](http://gridstackjs.com/demo/float.html)
     */
    float(val) {
        /*
        if (val === undefined) {
          // TODO: should we support and/or change signature ? figure this soon...
          console.warn('gridstack.ts: getter `float()` is deprecated in 2.x and has been replaced by `getFloat()`. It will be **completely** removed soon');
          return this.getFloat();
        }
        */
        this.engine.float = val;
        this._triggerChangeEvent();
        return this;
    }
    /**
     * get the current float mode
     */
    getFloat() {
        return this.engine.float;
    }
    /**
     * Get the position of the cell under a pixel on screen.
     * @param position the position of the pixel to resolve in
     * absolute coordinates, as an object with top and left properties
     * @param useDocRelative if true, value will be based on document position vs parent position (Optional. Default false).
     * Useful when grid is within `position: relative` element
     *
     * Returns an object with properties `x` and `y` i.e. the column and row in the grid.
     */
    getCellFromPixel(position, useDocRelative = false) {
        let box = this.el.getBoundingClientRect();
        // console.log(`getBoundingClientRect left: ${box.left} top: ${box.top} w: ${box.w} h: ${box.h}`)
        let containerPos;
        if (useDocRelative) {
            containerPos = { top: box.top + document.documentElement.scrollTop, left: box.left };
            // console.log(`getCellFromPixel scrollTop: ${document.documentElement.scrollTop}`)
        }
        else {
            containerPos = { top: this.el.offsetTop, left: this.el.offsetLeft };
            // console.log(`getCellFromPixel offsetTop: ${containerPos.left} offsetLeft: ${containerPos.top}`)
        }
        let relativeLeft = position.left - containerPos.left;
        let relativeTop = position.top - containerPos.top;
        let columnWidth = (box.width / this.opts.column);
        let rowHeight = (box.height / parseInt(this.el.getAttribute('gs-current-row')));
        return { x: Math.floor(relativeLeft / columnWidth), y: Math.floor(relativeTop / rowHeight) };
    }
    /** returns the current number of rows, which will be at least `minRow` if set */
    getRow() {
        return Math.max(this.engine.getRow(), this.opts.minRow);
    }
    /**
     * Checks if specified area is empty.
     * @param x the position x.
     * @param y the position y.
     * @param w the width of to check
     * @param h the height of to check
     */
    isAreaEmpty(x, y, w, h) {
        return this.engine.isAreaEmpty(x, y, w, h);
    }
    /**
     * If you add elements to your grid by hand, you have to tell gridstack afterwards to make them widgets.
     * If you want gridstack to add the elements for you, use `addWidget()` instead.
     * Makes the given element a widget and returns it.
     * @param els widget or single selector to convert.
     *
     * @example
     * let grid = GridStack.init();
     * grid.el.appendChild('<div id="gsi-1" gs-w="3"></div>');
     * grid.makeWidget('#gsi-1');
     */
    makeWidget(els) {
        let el = GridStack.getElement(els);
        this._prepareElement(el, true);
        this._updateContainerHeight();
        this._triggerAddEvent();
        this._triggerChangeEvent();
        return el;
    }
    /**
     * Event handler that extracts our CustomEvent data out automatically for receiving custom
     * notifications (see doc for supported events)
     * @param name of the event (see possible values) or list of names space separated
     * @param callback function called with event and optional second/third param
     * (see README documentation for each signature).
     *
     * @example
     * grid.on('added', function(e, items) { log('added ', items)} );
     * or
     * grid.on('added removed change', function(e, items) { log(e.type, items)} );
     *
     * Note: in some cases it is the same as calling native handler and parsing the event.
     * grid.el.addEventListener('added', function(event) { log('added ', event.detail)} );
     *
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    on(name, callback) {
        // check for array of names being passed instead
        if (name.indexOf(' ') !== -1) {
            let names = name.split(' ');
            names.forEach(name => this.on(name, callback));
            return this;
        }
        if (name === 'change' || name === 'added' || name === 'removed' || name === 'enable' || name === 'disable') {
            // native CustomEvent handlers - cash the generic handlers so we can easily remove
            let noData = (name === 'enable' || name === 'disable');
            if (noData) {
                this._gsEventHandler[name] = (event) => callback(event);
            }
            else {
                this._gsEventHandler[name] = (event) => callback(event, event.detail);
            }
            this.el.addEventListener(name, this._gsEventHandler[name]);
        }
        else if (name === 'dragstart' || name === 'dragstop' || name === 'resizestart' || name === 'resizestop' || name === 'dropped') {
            // drag&drop stop events NEED to be call them AFTER we update node attributes so handle them ourself.
            // do same for start event to make it easier...
            this._gsEventHandler[name] = callback;
        }
        else {
            console.log('GridStack.on(' + name + ') event not supported, but you can still use $(".grid-stack").on(...) while jquery-ui is still used internally.');
        }
        return this;
    }
    /**
     * unsubscribe from the 'on' event below
     * @param name of the event (see possible values)
     */
    off(name) {
        // check for array of names being passed instead
        if (name.indexOf(' ') !== -1) {
            let names = name.split(' ');
            names.forEach(name => this.off(name));
            return this;
        }
        if (name === 'change' || name === 'added' || name === 'removed' || name === 'enable' || name === 'disable') {
            // remove native CustomEvent handlers
            if (this._gsEventHandler[name]) {
                this.el.removeEventListener(name, this._gsEventHandler[name]);
            }
        }
        delete this._gsEventHandler[name];
        return this;
    }
    /**
     * Removes widget from the grid.
     * @param el  widget or selector to modify
     * @param removeDOM if `false` DOM element won't be removed from the tree (Default? true).
     * @param triggerEvent if `false` (quiet mode) element will not be added to removed list and no 'removed' callbacks will be called (Default? true).
     */
    removeWidget(els, removeDOM = true, triggerEvent = true) {
        GridStack.getElements(els).forEach(el => {
            if (el.parentElement !== this.el)
                return; // not our child!
            let node = el.gridstackNode;
            // For Meteor support: https://github.com/gridstack/gridstack.js/pull/272
            if (!node) {
                node = this.engine.nodes.find(n => el === n.el);
            }
            if (!node)
                return;
            // remove our DOM data (circular link) and drag&drop permanently
            delete el.gridstackNode;
            gridstack_ddi_1.GridStackDDI.get().remove(el);
            this.engine.removeNode(node, removeDOM, triggerEvent);
            if (removeDOM && el.parentElement) {
                el.remove(); // in batch mode engine.removeNode doesn't call back to remove DOM
            }
        });
        if (triggerEvent) {
            this._triggerRemoveEvent();
            this._triggerChangeEvent();
        }
        return this;
    }
    /**
     * Removes all widgets from the grid.
     * @param removeDOM if `false` DOM elements won't be removed from the tree (Default? `true`).
     */
    removeAll(removeDOM = true) {
        // always remove our DOM data (circular link) before list gets emptied and drag&drop permanently
        this.engine.nodes.forEach(n => {
            delete n.el.gridstackNode;
            gridstack_ddi_1.GridStackDDI.get().remove(n.el);
        });
        this.engine.removeAll(removeDOM);
        this._triggerRemoveEvent();
        return this;
    }
    /**
     * Toggle the grid animation state.  Toggles the `grid-stack-animate` class.
     * @param doAnimate if true the grid will animate.
     */
    setAnimation(doAnimate) {
        if (doAnimate) {
            this.el.classList.add('grid-stack-animate');
        }
        else {
            this.el.classList.remove('grid-stack-animate');
        }
        return this;
    }
    /**
     * Toggle the grid static state, which permanently removes/add Drag&Drop support, unlike disable()/enable() that just turns it off/on.
     * Also toggle the grid-stack-static class.
     * @param val if true the grid become static.
     */
    setStatic(val) {
        if (this.opts.staticGrid === val) {
            return this;
        }
        this.opts.staticGrid = val;
        this.engine.nodes.forEach(n => this._prepareDragDropByNode(n)); // either delete Drag&drop or initialize it
        this._setStaticClass();
        return this;
    }
    /**
     * Updates widget position/size and other info. Note: if you need to call this on all nodes, use load() instead which will update what changed.
     * @param els  widget or selector of objects to modify (note: setting the same x,y for multiple items will be indeterministic and likely unwanted)
     * @param opt new widget options (x,y,w,h, etc..). Only those set will be updated.
     */
    update(els, opt) {
        // support legacy call for now ?
        if (arguments.length > 2) {
            console.warn('gridstack.ts: `update(el, x, y, w, h)` is deprecated. Use `update({x, w, content, ...})`. It will be removed soon');
            // eslint-disable-next-line prefer-rest-params
            let a = arguments, i = 1;
            opt = { x: a[i++], y: a[i++], w: a[i++], h: a[i++] };
            return this.update(els, opt);
        }
        GridStack.getElements(els).forEach(el => {
            if (!el || !el.gridstackNode) {
                return;
            }
            let n = el.gridstackNode;
            let w = Object.assign({}, opt); // make a copy we can modify in case they re-use it or multiple items
            delete w.autoPosition;
            // move/resize widget if anything changed
            let keys = ['x', 'y', 'w', 'h'];
            let m;
            if (keys.some(k => w[k] !== undefined && w[k] !== n[k])) {
                m = {};
                keys.forEach(k => {
                    m[k] = (w[k] !== undefined) ? w[k] : n[k];
                    delete w[k];
                });
            }
            // for a move as well IFF there is any min/max fields set
            if (!m && (w.minW || w.minH || w.maxW || w.maxH)) {
                m = {}; // will use node position but validate values
            }
            // check for content changing
            if (w.content) {
                let sub = el.querySelector('.grid-stack-item-content');
                if (sub && sub.innerHTML !== w.content) {
                    sub.innerHTML = w.content;
                }
                delete w.content;
            }
            // any remaining fields are assigned, but check for dragging changes, resize constrain
            let changed = false;
            let ddChanged = false;
            for (const key in w) {
                if (key[0] !== '_' && n[key] !== w[key]) {
                    n[key] = w[key];
                    changed = true;
                    ddChanged = ddChanged || (!this.opts.staticGrid && (key === 'noResize' || key === 'noMove' || key === 'locked'));
                }
            }
            // finally move the widget
            if (m) {
                this.engine.cleanNodes();
                this.engine.beginUpdate(n);
                this.engine.moveNode(n, m.x, m.y, m.w, m.h);
                this._updateContainerHeight();
                this._triggerChangeEvent();
                this.engine.endUpdate();
            }
            if (changed) { // move will only update x,y,w,h so update the rest too
                this._writeAttr(el, n);
            }
            if (ddChanged) {
                this._prepareDragDropByNode(n);
            }
        });
        return this;
    }
    /**
     * Updates the margins which will set all 4 sides at once - see `GridStackOptions.margin` for format options (CSS string format of 1,2,4 values or single number).
     * @param value margin value
     */
    margin(value) {
        let isMultiValue = (typeof value === 'string' && value.split(' ').length > 1);
        // check if we can skip re-creating our CSS file... won't check if multi values (too much hassle)
        if (!isMultiValue) {
            let data = utils_1.Utils.parseHeight(value);
            if (this.opts.marginUnit === data.unit && this.opts.margin === data.h)
                return;
        }
        // re-use existing margin handling
        this.opts.margin = value;
        this.opts.marginTop = this.opts.marginBottom = this.opts.marginLeft = this.opts.marginRight = undefined;
        this.initMargin();
        this._updateStyles(true); // true = force re-create
        return this;
    }
    /** returns current margin number value (undefined if 4 sides don't match) */
    getMargin() { return this.opts.margin; }
    /**
     * Returns true if the height of the grid will be less than the vertical
     * constraint. Always returns true if grid doesn't have height constraint.
     * @param node contains x,y,w,h,auto-position options
     *
     * @example
     * if (grid.willItFit(newWidget)) {
     *   grid.addWidget(newWidget);
     * } else {
     *   alert('Not enough free space to place the widget');
     * }
     */
    willItFit(node) {
        // support legacy call for now
        if (arguments.length > 1) {
            console.warn('gridstack.ts: `willItFit(x,y,w,h,autoPosition)` is deprecated. Use `willItFit({x, y,...})`. It will be removed soon');
            // eslint-disable-next-line prefer-rest-params
            let a = arguments, i = 0, w = { x: a[i++], y: a[i++], w: a[i++], h: a[i++], autoPosition: a[i++] };
            return this.willItFit(w);
        }
        return this.engine.willItFit(node);
    }
    /** @internal */
    _triggerChangeEvent() {
        if (this.engine.batchMode) {
            return this;
        }
        let elements = this.engine.getDirtyNodes(true); // verify they really changed
        if (elements && elements.length) {
            if (!this._ignoreLayoutsNodeChange) {
                this.engine.layoutsNodesChange(elements);
            }
            this._triggerEvent('change', elements);
        }
        this.engine.saveInitial(); // we called, now reset initial values & dirty flags
        return this;
    }
    /** @internal */
    _triggerAddEvent() {
        if (this.engine.batchMode) {
            return this;
        }
        if (this.engine.addedNodes && this.engine.addedNodes.length > 0) {
            if (!this._ignoreLayoutsNodeChange) {
                this.engine.layoutsNodesChange(this.engine.addedNodes);
            }
            // prevent added nodes from also triggering 'change' event (which is called next)
            this.engine.addedNodes.forEach(n => { delete n._dirty; });
            this._triggerEvent('added', this.engine.addedNodes);
            this.engine.addedNodes = [];
        }
        return this;
    }
    /** @internal */
    _triggerRemoveEvent() {
        if (this.engine.batchMode) {
            return this;
        }
        if (this.engine.removedNodes && this.engine.removedNodes.length > 0) {
            this._triggerEvent('removed', this.engine.removedNodes);
            this.engine.removedNodes = [];
        }
        return this;
    }
    /** @internal */
    _triggerEvent(name, data) {
        let event = data ? new CustomEvent(name, { bubbles: false, detail: data }) : new Event(name);
        this.el.dispatchEvent(event);
        return this;
    }
    /** @internal called to delete the current dynamic style sheet used for our layout */
    _removeStylesheet() {
        if (this._styles) {
            utils_1.Utils.removeStylesheet(this._styles._id);
            delete this._styles;
        }
        return this;
    }
    /** @internal updated/create the CSS styles for row based layout and initial margin setting */
    _updateStyles(forceUpdate = false, maxH) {
        // call to delete existing one if we change cellHeight / margin
        if (forceUpdate) {
            this._removeStylesheet();
        }
        this._updateContainerHeight();
        // if user is telling us they will handle the CSS themselves by setting heights to 0. Do we need this opts really ??
        if (this.opts.cellHeight === 0) {
            return this;
        }
        let cellHeight = this.opts.cellHeight;
        let cellHeightUnit = this.opts.cellHeightUnit;
        let prefix = `.${this.opts._styleSheetClass} > .${this.opts.itemClass}`;
        // create one as needed
        if (!this._styles) {
            let id = 'gridstack-style-' + (Math.random() * 100000).toFixed();
            // insert style to parent (instead of 'head' by default) to support WebComponent
            let styleLocation = this.opts.styleInHead ? undefined : this.el.parentNode;
            this._styles = utils_1.Utils.createStylesheet(id, styleLocation);
            if (!this._styles) {
                return this;
            }
            this._styles._id = id;
            this._styles._max = 0;
            // these are done once only
            utils_1.Utils.addCSSRule(this._styles, prefix, `min-height: ${cellHeight}${cellHeightUnit}`);
            // content margins
            let top = this.opts.marginTop + this.opts.marginUnit;
            let bottom = this.opts.marginBottom + this.opts.marginUnit;
            let right = this.opts.marginRight + this.opts.marginUnit;
            let left = this.opts.marginLeft + this.opts.marginUnit;
            let content = `${prefix} > .grid-stack-item-content`;
            let placeholder = `.${this.opts._styleSheetClass} > .grid-stack-placeholder > .placeholder-content`;
            utils_1.Utils.addCSSRule(this._styles, content, `top: ${top}; right: ${right}; bottom: ${bottom}; left: ${left};`);
            utils_1.Utils.addCSSRule(this._styles, placeholder, `top: ${top}; right: ${right}; bottom: ${bottom}; left: ${left};`);
            // resize handles offset (to match margin)
            utils_1.Utils.addCSSRule(this._styles, `${prefix} > .ui-resizable-ne`, `right: ${right}`);
            utils_1.Utils.addCSSRule(this._styles, `${prefix} > .ui-resizable-e`, `right: ${right}`);
            utils_1.Utils.addCSSRule(this._styles, `${prefix} > .ui-resizable-se`, `right: ${right}; bottom: ${bottom}`);
            utils_1.Utils.addCSSRule(this._styles, `${prefix} > .ui-resizable-nw`, `left: ${left}`);
            utils_1.Utils.addCSSRule(this._styles, `${prefix} > .ui-resizable-w`, `left: ${left}`);
            utils_1.Utils.addCSSRule(this._styles, `${prefix} > .ui-resizable-sw`, `left: ${left}; bottom: ${bottom}`);
        }
        // now update the height specific fields
        maxH = maxH || this._styles._max;
        if (maxH > this._styles._max) {
            let getHeight = (rows) => (cellHeight * rows) + cellHeightUnit;
            for (let i = this._styles._max + 1; i <= maxH; i++) { // start at 1
                let h = getHeight(i);
                utils_1.Utils.addCSSRule(this._styles, `${prefix}[gs-y="${i - 1}"]`, `top: ${getHeight(i - 1)}`); // start at 0
                utils_1.Utils.addCSSRule(this._styles, `${prefix}[gs-h="${i}"]`, `height: ${h}`);
                utils_1.Utils.addCSSRule(this._styles, `${prefix}[gs-min-h="${i}"]`, `min-height: ${h}`);
                utils_1.Utils.addCSSRule(this._styles, `${prefix}[gs-max-h="${i}"]`, `max-height: ${h}`);
            }
            this._styles._max = maxH;
        }
        return this;
    }
    /** @internal */
    _updateContainerHeight() {
        if (!this.engine || this.engine.batchMode) {
            return this;
        }
        let row = this.getRow(); // checks for minRow already
        // check for css min height
        let cssMinHeight = parseInt(getComputedStyle(this.el)['min-height']);
        if (cssMinHeight > 0) {
            let minRow = Math.round(cssMinHeight / this.getCellHeight(true));
            if (row < minRow) {
                row = minRow;
            }
        }
        this.el.setAttribute('gs-current-row', String(row));
        if (row === 0) {
            this.el.style.removeProperty('height');
            return this;
        }
        let cellHeight = this.opts.cellHeight;
        let unit = this.opts.cellHeightUnit;
        if (!cellHeight) {
            return this;
        }
        this.el.style.height = row * cellHeight + unit;
        return this;
    }
    /** called to resize children nested grids when we/item resizes */
    _resizeNestedGrids(target) {
        target.querySelectorAll('.grid-stack').forEach((el) => {
            if (el.gridstack) {
                el.gridstack.onParentResize();
            }
        });
        return this;
    }
    /** @internal */
    _prepareElement(el, triggerAddEvent = false, node) {
        if (!node) {
            el.classList.add(this.opts.itemClass);
            node = this._readAttr(el);
        }
        el.gridstackNode = node;
        node.el = el;
        node.grid = this;
        let copy = Object.assign({}, node);
        node = this.engine.addNode(node, triggerAddEvent);
        // write node attr back in case there was collision or we have to fix bad values during addNode()
        if (!utils_1.Utils.same(node, copy)) {
            this._writeAttr(el, node);
        }
        this._prepareDragDropByNode(node);
        return this;
    }
    /** @internal call to write x,y,w,h attributes back to element */
    _writePosAttr(el, x, y, w, h) {
        if (x !== undefined && x !== null) {
            el.setAttribute('gs-x', String(x));
        }
        if (y !== undefined && y !== null) {
            el.setAttribute('gs-y', String(y));
        }
        if (w) {
            el.setAttribute('gs-w', String(w));
        }
        if (h) {
            el.setAttribute('gs-h', String(h));
        }
        return this;
    }
    /** @internal call to write any default attributes back to element */
    _writeAttr(el, node) {
        if (!node)
            return this;
        this._writePosAttr(el, node.x, node.y, node.w, node.h);
        let attrs /*: GridStackWidget but strings */ = {
            autoPosition: 'gs-auto-position',
            minW: 'gs-min-w',
            minH: 'gs-min-h',
            maxW: 'gs-max-w',
            maxH: 'gs-max-h',
            noResize: 'gs-no-resize',
            noMove: 'gs-no-move',
            locked: 'gs-locked',
            id: 'gs-id',
            resizeHandles: 'gs-resize-handles'
        };
        for (const key in attrs) {
            if (node[key]) { // 0 is valid for x,y only but done above already and not in list anyway
                el.setAttribute(attrs[key], String(node[key]));
            }
            else {
                el.removeAttribute(attrs[key]);
            }
        }
        return this;
    }
    /** @internal call to read any default attributes from element */
    _readAttr(el) {
        let node = {};
        node.x = utils_1.Utils.toNumber(el.getAttribute('gs-x'));
        node.y = utils_1.Utils.toNumber(el.getAttribute('gs-y'));
        node.w = utils_1.Utils.toNumber(el.getAttribute('gs-w'));
        node.h = utils_1.Utils.toNumber(el.getAttribute('gs-h'));
        node.maxW = utils_1.Utils.toNumber(el.getAttribute('gs-max-w'));
        node.minW = utils_1.Utils.toNumber(el.getAttribute('gs-min-w'));
        node.maxH = utils_1.Utils.toNumber(el.getAttribute('gs-max-h'));
        node.minH = utils_1.Utils.toNumber(el.getAttribute('gs-min-h'));
        node.autoPosition = utils_1.Utils.toBool(el.getAttribute('gs-auto-position'));
        node.noResize = utils_1.Utils.toBool(el.getAttribute('gs-no-resize'));
        node.noMove = utils_1.Utils.toBool(el.getAttribute('gs-no-move'));
        node.locked = utils_1.Utils.toBool(el.getAttribute('gs-locked'));
        node.resizeHandles = el.getAttribute('gs-resize-handles');
        node.id = el.getAttribute('gs-id');
        // remove any key not found (null or false which is default)
        for (const key in node) {
            if (!node.hasOwnProperty(key)) {
                return;
            }
            if (!node[key] && node[key] !== 0) { // 0 can be valid value (x,y only really)
                delete node[key];
            }
        }
        return node;
    }
    /** @internal */
    _setStaticClass() {
        let classes = ['grid-stack-static'];
        if (this.opts.staticGrid) {
            this.el.classList.add(...classes);
            this.el.setAttribute('gs-static', 'true');
        }
        else {
            this.el.classList.remove(...classes);
            this.el.removeAttribute('gs-static');
        }
        return this;
    }
    /**
     * called when we are being resized by the window - check if the one Column Mode needs to be turned on/off
     * and remember the prev columns we used, as well as check for auto cell height (square)
     */
    onParentResize() {
        if (!this.el || !this.el.clientWidth)
            return; // return if we're gone or no size yet (will get called again)
        // make the cells content (minus margin) square again
        if (this._isAutoCellHeight) {
            utils_1.Utils.throttle(() => {
                let marginDiff = -this.opts.marginRight - this.opts.marginLeft
                    + this.opts.marginTop + this.opts.marginBottom;
                this.cellHeight(this.cellWidth() + marginDiff);
            }, 100);
        }
        if (!this.opts.disableOneColumnMode && this.el.clientWidth <= this.opts.minWidth) {
            if (this._oneColumnMode) {
                return this;
            }
            this._oneColumnMode = true;
            this.column(1);
            this._resizeNestedGrids(this.el);
        }
        else {
            if (!this._oneColumnMode) {
                return this;
            }
            delete this._oneColumnMode;
            this.column(this._prevColumn);
            this._resizeNestedGrids(this.el);
        }
        return this;
    }
    /** add or remove the window size event handler */
    _updateWindowResizeEvent(forceRemove = false) {
        const workTodo = (this._isAutoCellHeight || !this.opts.disableOneColumnMode);
        // only add event if we're not nested (parent will call us) and we're auto sizing cells or supporting oneColumn (i.e. doing work)
        if (workTodo && !forceRemove && !this.opts._isNested && !this._windowResizeBind) {
            this._windowResizeBind = this.onParentResize.bind(this); // so we can properly remove later
            window.addEventListener('resize', this._windowResizeBind);
            this.onParentResize(); // initially call it once...
        }
        else if ((forceRemove || !workTodo) && this._windowResizeBind) {
            window.removeEventListener('resize', this._windowResizeBind);
            delete this._windowResizeBind; // remove link to us so we can free
        }
        return this;
    }
    /** @internal convert a potential selector into actual element */
    static getElement(els = '.grid-stack-item') { return utils_1.Utils.getElement(els); }
    /** @internal */
    static getElements(els = '.grid-stack-item') { return utils_1.Utils.getElements(els); }
    /** @internal */
    static getGridElement(els) { return GridStack.getElement(els); }
    /** @internal */
    static getGridElements(els) { return utils_1.Utils.getElements(els); }
    /** @internal initialize margin top/bottom/left/right and units */
    initMargin() {
        let data;
        let margin = 0;
        // support passing multiple values like CSS (ex: '5px 10px 0 20px')
        let margins = [];
        if (typeof this.opts.margin === 'string') {
            margins = this.opts.margin.split(' ');
        }
        if (margins.length === 2) { // top/bot, left/right like CSS
            this.opts.marginTop = this.opts.marginBottom = margins[0];
            this.opts.marginLeft = this.opts.marginRight = margins[1];
        }
        else if (margins.length === 4) { // Clockwise like CSS
            this.opts.marginTop = margins[0];
            this.opts.marginRight = margins[1];
            this.opts.marginBottom = margins[2];
            this.opts.marginLeft = margins[3];
        }
        else {
            data = utils_1.Utils.parseHeight(this.opts.margin);
            this.opts.marginUnit = data.unit;
            margin = this.opts.margin = data.h;
        }
        // see if top/bottom/left/right need to be set as well
        if (this.opts.marginTop === undefined) {
            this.opts.marginTop = margin;
        }
        else {
            data = utils_1.Utils.parseHeight(this.opts.marginTop);
            this.opts.marginTop = data.h;
            delete this.opts.margin;
        }
        if (this.opts.marginBottom === undefined) {
            this.opts.marginBottom = margin;
        }
        else {
            data = utils_1.Utils.parseHeight(this.opts.marginBottom);
            this.opts.marginBottom = data.h;
            delete this.opts.margin;
        }
        if (this.opts.marginRight === undefined) {
            this.opts.marginRight = margin;
        }
        else {
            data = utils_1.Utils.parseHeight(this.opts.marginRight);
            this.opts.marginRight = data.h;
            delete this.opts.margin;
        }
        if (this.opts.marginLeft === undefined) {
            this.opts.marginLeft = margin;
        }
        else {
            data = utils_1.Utils.parseHeight(this.opts.marginLeft);
            this.opts.marginLeft = data.h;
            delete this.opts.margin;
        }
        this.opts.marginUnit = data.unit; // in case side were spelled out, use those units instead...
        if (this.opts.marginTop === this.opts.marginBottom && this.opts.marginLeft === this.opts.marginRight && this.opts.marginTop === this.opts.marginRight) {
            this.opts.margin = this.opts.marginTop; // makes it easier to check for no-ops in setMargin()
        }
        return this;
    }
    /*
     * drag&drop empty stubs that will be implemented in gridstack-dd.ts for non static grid
     * so we don't incur the load unless needed.
     * NOTE: had to make those methods public in order to define them else as
     *   GridStack.prototype._setupAcceptWidget = function()
     * maybe there is a better way....
     */
    /* eslint-disable @typescript-eslint/no-unused-vars */
    /**
     * Enables/Disables moving. No-op for static grids.
     * @param els widget or selector to modify.
     * @param val if true widget will be draggable.
     */
    movable(els, val) { return this; }
    /**
     * Enables/Disables resizing. No-op for static grids.
     * @param els  widget or selector to modify
     * @param val  if true widget will be resizable.
     */
    resizable(els, val) { return this; }
    /** @internal called to add drag over support to support widgets */
    _setupAcceptWidget() { return this; }
    /** @internal called to setup a trash drop zone if the user specifies it */
    _setupRemoveDrop() { return this; }
    /** @internal */
    _setupRemovingTimeout(el) { return this; }
    /** @internal */
    _clearRemovingTimeout(el) { return this; }
    /** @internal call to setup dragging in from the outside (say toolbar), with options */
    _setupDragIn() { return this; }
    /** @internal prepares the element for drag&drop **/
    _prepareDragDropByNode(node) { return this; }
    // 2.x API that just calls the new and better update() - keep those around for backward compat only...
    /** @internal */
    locked(els, locked) { return this.update(els, { locked }); }
    /** @internal */
    maxWidth(els, maxW) { return this.update(els, { maxW }); }
    /** @internal */
    minWidth(els, minW) { return this.update(els, { minW }); }
    /** @internal */
    maxHeight(els, maxH) { return this.update(els, { maxH }); }
    /** @internal */
    minHeight(els, minH) { return this.update(els, { minH }); }
    /** @internal */
    move(els, x, y) { return this.update(els, { x, y }); }
    /** @internal */
    resize(els, w, h) { return this.update(els, { w, h }); }
}
exports.GridStack = GridStack;
/** scoping so users can call GridStack.Utils.sort() for example */
GridStack.Utils = utils_1.Utils;
/** scoping so users can call new GridStack.Engine(12) for example */
GridStack.Engine = gridstack_engine_1.GridStackEngine;
//# sourceMappingURL=gridstack.js.map