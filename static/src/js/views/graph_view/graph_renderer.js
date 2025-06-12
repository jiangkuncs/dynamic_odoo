odoo.define('dynamic_odoo.GraphRenderer', function (require) {
"use strict";

    var core = require('web.core');
    var GraphRenderer = require('web.GraphRenderer');

    var _t = core._t;
    var QWeb = core.qweb;

    var NO_DATA = [_t('No data')];
    NO_DATA.isNoData = true;


    GraphRenderer.include({
        // init: function (parent, state, params) {
        //     this._super.apply(this, arguments);
        // },
        _getLegendOptions: function (data) {
            const oldMode = this.state.mode;
            if (this.state.mode == "column") {
                this.state.mode = "bar";
            }
            const res = this._super(data);
            if (oldMode == "column") {
                this.state.mode = "column";
            }
            return res;
        },
        _getDatasetLabel: function (data) {
            const oldMode = this.state.mode;
            if (this.state.mode == "column") {
                this.state.mode = "bar";
            }
            const res = this._super(data);
            if (oldMode == "column") {
                this.state.mode = "column";
            }
            return res;
        },
        _prepareData: function (dataPoints) {
            const data = this._super(dataPoints), props = this.arch.attrs, mode = this.state.mode;
            if (mode == "line") {
                const {smooth} = props || {};
                data.datasets.map((dataSet) => {
                    if (smooth) {
                        dataSet.lineTension = 0.4
                    }
                });
            }
            return data;
        },
        _filterDataPoints: function () {
            if (["polar_area", "donut", "column"].includes(this.state.mode)) {
                return this.state.dataPoints.filter(function (dataPt) {
                    return dataPt.count > 0;
                });
            }
            return this._super();
        },
        _render: function () {
            if (["polar_area", "donut", "column"].includes(this.state.mode)) {
                if (this.chart) {
                    this.chart.destroy();
                }
                this.$el.empty();
                var dataPoints = this._filterDataPoints();
                if (!dataPoints.length) {
                    this.$el.append(QWeb.render('View.NoContentHelper'));
                } else if (this.isInDOM){
                    const $canvasContainer = $('<div/>', {class: 'o_graph_canvas_container'}),
                        $canvas = $('<canvas/>').attr('id', this.chartId);
                    this.$el.append($canvasContainer.append($canvas));
                    if (this.state.comparisonFieldIndex == 0) {
                        this.dateClasses = this['_getDateClasses'](dataPoints);
                    }
                    switch (this.state.mode) {
                        case "polar_area":
                            this._renderPolarArea(dataPoints);
                            break;
                        case "donut":
                            this._renderDoughnut(dataPoints);
                            break;
                        case "column":
                            this._renderColumnChart(dataPoints);
                            break;
                    }
                    this['_renderTitle']();
                }
                return Promise.resolve();
            }else {
                return this._super.apply(this, arguments);
            }
        },
        _renderLineChart: function (dataPoints) {
            this._super(dataPoints);
            const colorHelper = Chart.helpers.color, {area, smooth} = this.arch.attrs;
            this.chart.config.data.datasets.map((data, index) => {
                if (area) {
                    const color = this['_getColor'](index);
                    data.backgroundColor = colorHelper(color).alpha(0.2).rgbString();
                    data.fill = 'origin';
                    data.borderColor = color;
                }else {
                    delete data.backgroundColor;
                    delete data.fill;
                }
                if (smooth) {
                    data.lineTension = 0.4;
                }
            });
            this.chart.update();
        },
        _renderColumnChart: function (dataPoints) {
            // return this._renderRadar(dataPoints);

            var self = this;

            // prepare data
            var data = this._prepareData(dataPoints);

            data.datasets.forEach(function (dataset, index) {
                // used when stacked
                dataset.stack = self.state.stacked ? self.state.origins[dataset.originIndex] : undefined;
                // set dataset color
                var color = self._getColor(index);
                dataset.backgroundColor = color;
            });

            // prepare options
            var options = this._prepareOptions(data.datasets.length);

            // create chart
            var ctx = document.getElementById(this.chartId);
            this.chart = new Chart(ctx, {
                type: 'horizontalBar',
                data: data,
                options: options,
            });
        },
        _renderDonutAndPolar: function (dataPoints, type) {
            var self = this, allNegative = true, someNegative = false, allZero = true;
            dataPoints.forEach(function (datapt) {
                allNegative = allNegative && (datapt.value < 0);
                someNegative = someNegative || (datapt.value < 0);
                allZero = allZero && (datapt.value === 0);
            });
            if (someNegative && !allNegative) {
                this.$el.empty();
                this.$el.append(QWeb.render('View.NoContentHelper', {
                    title: _t("Invalid data"),
                    description: _t("Pie chart cannot mix positive and negative numbers. " +
                        "Try to change your domain to only display positive results"),
                }));
                return;
            }
            if (allZero && !this.isEmbedded && this.state.origins.length === 1) {
                this.$el.empty();
                this.$el.append(QWeb.render('View.NoContentHelper', {
                    title: _t("Invalid data"),
                    description: _t("Pie chart cannot display all zero numbers.. " +
                        "Try to change your domain to display positive results"),
                }));
                return;
            }
            // prepare data
            var data = {};
            var colors = [];
            if (allZero) {
                // add fake data to display a pie chart with a grey zone associated
                // with every origin
                data.labels = [NO_DATA];
                data.datasets = this.state.origins.map(function (origin) {
                    return {
                        label: origin,
                        data: [1],
                        backgroundColor: ['#d3d3d3'],
                    };
                });
            } else {
                data = this._prepareData(dataPoints);
                // give same color to same groups from different origins
                colors = data.labels.map(function (label, index) {
                    return self._getColor(index);
                });
                data.datasets.forEach(function (dataset) {
                    dataset.backgroundColor = colors;
                    dataset.borderColor = 'rgba(255,255,255,0.6)';
                });
                // make sure there is a zone associated with every origin
                var representedOriginIndexes = data.datasets.map(function (dataset) {
                    return dataset.originIndex;
                });
                var addNoDataToLegend = false;
                var fakeData = (new Array(data.labels.length)).concat([1]);
                this.state.origins.forEach(function (origin, originIndex) {
                    if (!_.contains(representedOriginIndexes, originIndex)) {
                        data.datasets.splice(originIndex, 0, {
                            label: origin,
                            data: fakeData,
                            backgroundColor: colors.concat(['#d3d3d3']),
                        });
                        addNoDataToLegend = true;
                    }
                });
                if (addNoDataToLegend) {
                    data.labels.push(NO_DATA);
                }
            }

            var options = this._prepareOptions(data.datasets.length);
            var ctx = document.getElementById(this.chartId);
            this.chart = new Chart(ctx, {
                data: data,
                type: type,
                options: options
            });
        },
        _renderDoughnut: function (dataPoints) {
            this._renderDonutAndPolar(dataPoints, "doughnut");
        },
        _renderPolarArea: function (dataPoints) {
            this._renderDonutAndPolar(dataPoints, "polarArea");
        },
        _renderRadar: function (dataPoints) {
            var self = this;
            this.state.mode = "radar";
            // prepare data
            var colorHelper = Chart.helpers.color;
            var data = this._prepareData(dataPoints);
            data.datasets.map((dataSet, index) => {
                const color = self._getColor(index);
                dataSet.backgroundColor = colorHelper(color).alpha(0.2).rgbString();
                dataSet.borderColor = color;
            });
            // prepare options
            var options = this._prepareOptions(data.datasets.length);

            // create chart
            var ctx = document.getElementById(this.chartId);
            this.chart = new Chart(ctx, {
                type: 'radar',
                data: data,
                options: {...options, legend: {display: false}},
            });
        },
    });
});
