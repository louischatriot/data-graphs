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
  , 'displayLabels'
  , 'showTooltips'
  ].forEach(function (param) {
    self[param] = opts[param];
  });

  if (this.container) { this.$container = $(this.container); }
  this._left = opts._left || BarChart.statics._baseLeft;
  this._height = opts._height || BarChart.statics._baseHeight;
  this.scale = {};
  this.scale.minY = opts.minY;
  this.scale.maxY = opts.maxY;

  this.transitionDuration = opts.transitionDuration || 500;
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
  var count = 0, self = this;
  this.data = [];

  // Assumption: all items in the data array have the same format, just numbers or objects { datum, _id }
  if (data[0] && !data[0]._id) {
    data.forEach(function (d) { self.data.push({ datum: d, _id: count }); count += 1; });
  } else {
    this.data = data;
  }
  this.numBars = this.data.length;
  this.minY = _.min(_.pluck(this.data, 'datum'));
  this.maxY = _.max(_.pluck(this.data, 'datum'));

  if (this.useCustomScale && this.scale.minY !== undefined) { this.minY = this.scale.minY; }
  if (this.useCustomScale && this.scale.maxY !== undefined) { this.maxY = this.scale.maxY; }

  return this;
};
BarChart.prototype.withScale = function (scale) {
  this.scale = scale;

  if (this.useCustomScale && this.scale.minY !== undefined) { this.minY = this.scale.minY; }
  if (this.useCustomScale && this.scale.maxY !== undefined) { this.maxY = this.scale.maxY; }

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

// Main draxing function that assumes we are in a clean state (same number of bars as data)
// and which leaves a clean state
BarChart.prototype.redraw = function () {
  var self = this
    , initialDelay = 0
    , selection
    ;

  this.recalculateSizes();

  if (this.showTooltips) {
    $(this.container + ' div.bar').off('mouseover', null, showToolTip);
    $(this.container + ' div.bar').off('mouseleave', null, removeToolTip);
  }

  if (!d3.select(this.container).selectAll('div.bar').data(this.data, BarChart.statics.getId).exit().empty()) {
    initialDelay = this.transitionDuration;
  }

  // Transition old bars out
  d3.select(this.container).selectAll('div.bar').data(this.data, BarChart.statics.getId).exit()
    .transition().duration(this.transitionDuration)
    .style('height', '0px')
    .style('top', this.height + 'px')
    .remove()
    ;

  // Create new bars
  selection = d3.select(this.container).selectAll('div.bar').data(this.data, BarChart.statics.getId).enter().append('div')
    .attr('class', 'bar')
    .style('width', this.barWidth + 'px')
    .style('top', this.height + 'px')
    .style('left', function(d, i) { return self._left(d, i) + 'px'; })
    .style('height', '0px')
    ;

  // Create the labels for the new bars
  if (this.displayLabels) {
    selection.append('div').attr('class', 'label')
             .text(function (d) { return d[self.displayLabels] || d._id; })
             .style('width', '100%')
             ;
  }
 
  // First transition: horizontal rearrangement
  // Also put data for tooltip
  d3.select(this.container).selectAll('div.bar').data(this.data, BarChart.statics.getId)
    .transition().duration(this.transitionDuration).delay(initialDelay)
    .style('width', this.barWidth + 'px')
    .style('left', function(d, i) { return self._left(d, i) + 'px'; })
    .attr('data-description', function (d, i) { return d.description || ''; })
    ;

  // Second transition: vertical scaling
  d3.select(this.container).selectAll('div.bar').data(this.data, BarChart.statics.getId)
    .transition().duration(this.transitionDuration).delay(initialDelay + this.transitionDuration)
    .style('top', function(d, i) { return (self.height - self._height(d, i)) + 'px'; })
    .style('height', function(d, i) { return self._height(d, i) + 'px'; })
    ;

  this.redrawYAxis();

  if (this.showTooltips) {
    $(this.container + ' div.bar').on('mouseover', showToolTip);
    $(this.container + ' div.bar').on('mouseleave', removeToolTip);
  }
};

BarChart.prototype.redrawYAxis = function () {
  var self = this
    , ticks = d3.scale.linear().domain([this.minY, this.maxY]).ticks(5)
    ;

  d3.select(this.container).selectAll('div.ytick').data(ticks)
    .exit().remove();

  d3.select(this.container).selectAll('div.ytick').data(ticks)
    .enter().append('div').attr('class', 'ytick');

  d3.select(this.container).selectAll('div.ytick').data(ticks)
    .text(function (d) { return d; })
    .style('top', function(d, i) { return ((self.height - self._height(d, i)) - 6) + 'px'; })
    .style('right', (this.width + 10) + 'px')
    ;
};

BarChart.statics = {};
// _baseLeft and _baseHeight need to be added to the prototype of BarChart if no other plotting function is passed
BarChart.statics._baseLeft = function (x, i) {


  return this.spacing + (i * (this.spacing + this.barWidth));
};
BarChart.statics._baseHeight = function (y, i) {
  // This will work whether y is a number or an object with a datum property
  return ((y.datum || y) - this.minY) / (this.maxY - this.minY) * this.height;
};
BarChart.statics.getId = function (d)  { return d._id; };
//BarChart.statics.calculateStep = function (delta) {
  //var n = Math.floor(Math.log(delta) / Math.log(10))
    //, ticks = Math.floor(delta / Math.pow(n, 10)) + 2
    //;

  //delta = 
  
//};

function showToolTip (event) {
  var $target = $(event.target)
    , id = uid(12)
    , tooltipHtml
    ;

  // Tooltip already shown
  if ($target.data('tooltip-id')) { return; }
  // Not on a bar, only on a label
  if (!$target.hasClass('bar')) { return; }

  $target.data('tooltip-id', id);

  tooltipHtml = '<div class="tooltip" id="' + id + '" style="position: fixed; left: ' + event.pageX + 'px; top: ' + event.pageY + 'px;">VVVXXV' + $target.data('description') + '</div>';
  $target.append(tooltipHtml);
}

function removeToolTip (event) {
  var $target = $(event.target)
    , $parent, $tooltip
    ;

  if ($target.hasClass('bar')) {
    $parent = $target;
  } else {
    $parent = $target.parent();
  }

  $tooltip = $('#' + $parent.data('tooltip-id'));

  $tooltip.remove();
  $parent.data('tooltip-id', '');
}



// ===== TESTS =====
var bc = new BarChart({ useCustomScale: true
//, maxBarWidth: 20
, displayLabels: true
, showTooltips: true
});
bc.withContainer('#graph1')//.withWidth(700).withHeight(500);
bc.resizeContainer();
bc.withData([ { datum: 1, _id: "A" }
            , { datum: 12, _id: "B" }      
            , { datum: 4, _id: "C" }      
            , { datum: 7, _id: "D" }      
            , { datum: 5, _id: "E" }      
            , { datum: 6, _id: "F" }      
            , { datum: 7, _id: "G" }      
            ])/*.withScale({ minY: 0, maxY: 20 })*/.redraw();

$("#test").on('click', (function () { var count = 0; return function () {
  if (count === 0) {
    bc.withData([ { datum: 4, _id: "H" }
                , { datum: 2, _id: "D" }      
                , { datum: 17, _id: "C" }
                , { datum: 16, _id: "I" }      
                , { datum: 0, _id: "E" }      
                , { datum: 5, _id: "F" }      
                , { datum: 10, _id: "B" }      
                , { datum: 12, _id: "G" }      
                , { datum: 18, _id: "A" }      
                ]);

    bc.redraw();
  }

  if (count === 1) {
    bc.withData([ { datum: 4, _id: "B" }
                , { datum: 2, _id: "D" }      
                , { datum: 16, _id: "I" }      
                , { datum: 0, _id: "E" }      
                , { datum: 10, _id: "H" }      
                , { datum: 18, _id: "A" }      
                ]);

    bc.redraw();
  }

  count += 1;
}})());








