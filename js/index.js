/**
 * Animated bar chart
 *  * data: object x: y where x is a label and y a numerical value
 */
function BarChart(opts) {
  opts = opts || {};
  this.container = opts.container;
  if (this.container) { this.$container = $(this.container); }
  this.width = opts.width;
  this.height = opts.height;
  this.data = opts.data;
  this._left = opts._left || BarChart.statics._baseLeft;
  this._height = opts._height || BarChart.statics._baseHeight;
  this.scale = {};
  this.scale.minY = opts.minY;
  this.scale.maxY = opts.maxY;
  this.useCustomScale = opts.useCustomScale;
}

// Setters for convenience
BarChart.prototype.withContainer = function (container) {
  this.container = container;
  if (this.container) { this.$container = $(this.container); }
  return this;
};
BarChart.prototype.withWidth = function (width) {
  this.width = width;
  return this;
};
BarChart.prototype.withHeight = function (height) {
  this.height = height;
  return this;
};
BarChart.prototype.withData = function (data) {
  this.data = data;
  this.numBars = this.data.length;
  this.minY = _.min(this.data);
  this.maxY = _.max(this.data);
  return this;
};
BarChart.prototype.withScale = function (scale) {
  this.scale = scale;
  return this;
};

BarChart.prototype.resizeContainer = function () {
  if (!this.$container) { return; }
  if (this.width) { this.$container.css('width', this.width + 'px'); }
  if (this.height) { this.$container.css('height', this.height + 'px'); }
};

BarChart.prototype.redraw = function () {
  var self = this
    , sel = d3.select('#graph1').selectAll('div')
    ;

  sel.data(this.data).enter().append('div')
    .style('background-color', 'steelblue')
    .style('width', '10px')
    .style('top', function(d, i) { return (self.height - self._height(d, i)) + 'px'; })
    .style('left', function(d, i) { return self._left(d, i) + 'px'; })
    .style('height', function(d, i) { return self._height(d, i) + 'px'; })
    .style('position', 'absolute')
    ;
};

BarChart.statics = {};
// _baseLeft and _baseHeight need to be added to the prototype of BarChart if no other plotting function is passed
BarChart.statics._baseLeft = function (x, i) {
  return (i / this.numBars) * this.width;
};
BarChart.statics._baseHeight = function (y, i) {
  var minY = this.minY
    , maxY = this.maxY
    ;

  if (this.useCustomScale && this.scale.minY !== undefined) { minY = this.scale.minY; }
  if (this.useCustomScale && this.scale.maxY !== undefined) { maxY = this.scale.maxY; }

  return (y - minY) / (maxY - minY) * this.height;
};





// ===== TESTS =====
var bc = new BarChart({ useCustomScale: true });
bc.withContainer('#graph1').withWidth(700).withHeight(500);
bc.resizeContainer();
bc.withData([1, 12, 4, 7, 5, 6, 7]).withScale({ minY: 0, maxY: 20 }).redraw();










