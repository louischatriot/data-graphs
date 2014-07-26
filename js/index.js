/**
 * Animated bar chart
 *  * data: object x: y where x is a label and y a numerical value
 */
function BarChart(opts) {
  var self = this;

  opts = opts || {};

  [ 'container'
  , 'width'
  , 'height'
  , 'data'
  , 'useCustomScale'
  , 'maxBarWidth'
  ].forEach(function (param) {
    self[param] = opts[param];
  });

  if (this.container) { this.$container = $(this.container); }
  this._left = opts._left || BarChart.statics._baseLeft;
  this._height = opts._height || BarChart.statics._baseHeight;
  this.scale = {};
  this.scale.minY = opts.minY;
  this.scale.maxY = opts.maxY;
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

BarChart.prototype.recalculateSizes = function () {
  // Reset width and height if they changed or were never set
  this.width = this.$container.width();
  this.height = this.$container.height();

  // Recalculate bar width and spacing
  // Standard is bars are twice as large as spacing
  // Then we check for a cap on bar width
  var stdSpacing = this.width / (3 * this.numBars + 1)
    , stdBarWidth = 2 * stdSpacing
    , barWidth = this.maxBarWidth ? Math.min(stdBarWidth, this.maxBarWidth) : stdBarWidth
    , spacing =  (this.width - (this.numBars * barWidth)) / (this.numBars + 1)
    ;

  this.barWidth = barWidth;
  this.spacing = spacing;
};

BarChart.prototype.redraw = function () {
  var self = this
    ;

  this.recalculateSizes();

  // Prepare the new bars, put them all on the right with height 0
  d3.select(this.container).selectAll('div').data(this.data).enter().append('div')
    .style('background-color', 'steelblue')
    .style('width', this.barWidth + 'px')
    .style('top', this.height + 'px')
    .style('left', function(d, i) { return self._left(d, i) + 'px'; })
    .style('height', '0px')
    .style('position', 'absolute')
    ;
 

  d3.select(this.container).selectAll('div')//.data(this.data)
    .transition().duration(1000)
    .style('width', this.barWidth + 'px')
    .style('top', function(d, i) { return (self.height - self._height(d, i)) + 'px'; })
    .style('left', function(d, i) { return self._left(d, i) + 'px'; })
    .style('height', function(d, i) { return self._height(d, i) + 'px'; })
    ;
};

BarChart.statics = {};
// _baseLeft and _baseHeight need to be added to the prototype of BarChart if no other plotting function is passed
BarChart.statics._baseLeft = function (x, i) {
  return this.spacing + (i * (this.spacing + this.barWidth));
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
var bc = new BarChart({ useCustomScale: true
, maxBarWidth: 20
});
bc.withContainer('#graph1')//.withWidth(700).withHeight(500);
bc.resizeContainer();
bc.withData([1, 12, 4, 7, 5, 6, 7]).withScale({ minY: 0, maxY: 20 }).redraw();


$("#test").on('click', function () {
  bc.withData([4, 2, 17, 16, 0, 5, 10]);
  bc.redraw();
});








