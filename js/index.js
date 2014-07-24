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
  return this;
};

BarChart.prototype.resizeContainer = function () {
  if (!this.$container) { return; }
  if (this.width) { this.$container.css('width', this.width + 'px'); }
  if (this.height) { this.$container.css('height', this.height + 'px'); }
};

BarChart.statics = {};
// _baseLeft and _baseHeight need to be added to the prototype of BarChart if no other plotting function is passed
BarChart.statics._baseLeft = function (x, i) {
  var numPoints = Object.keys(this.data).length;
  return (i / numPoints) * this.width;
};





var bc = new BarChart();
bc.withContainer('#graph1').withWidth(200).withHeight(50);
bc.resizeContainer();


