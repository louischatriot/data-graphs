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
  , 'innerWidth'
  , 'innerHeight'
  , 'data'
  , 'useCustomScale'
  , 'maxBarWidth'
  , 'displayLabels'
  , 'showTooltips'
  ].forEach(function (param) {
    self[param] = opts[param];
  });

  // Creating the two containers
  this.$container = $(this.container);
  this.$container.html('<div class="bars-container"></div>');
  this.barsContainer = this.container + ' .bars-container';
  this.$barsContainer = $(this.barsContainer);
  this.$barsContainer.css('left', '40px');
  this.$barsContainer.css('right', '100px');
  this.$barsContainer.css('top', '0px');
  this.$barsContainer.css('bottom', '30px');

  this.scale = {};
  this.scale.minY = opts.minY;
  this.scale.maxY = opts.maxY;

  this.transitionDuration = opts.transitionDuration || 500;
}

BarChart.prototype.withWidth = function (width) {
  this.width = width;
  this.resizeContainer();
  return this;
};
BarChart.prototype.withHeight = function (height) {
  this.height = height;
  this.resizeContainer();
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
BarChart.prototype.withYAxisTitle = function (title, _width) {
  var width = _width || 200;
  if (width > this.$container.width()) { width = this.$container.width(); }

  if (!this.$yAxisTitle) {
    this.$container.append('<div class="y-axis-title">' + title + '</div>');
    this.$yAxisTitle = $(this.container + ' .y-axis-title');
  }

  this.$yAxisTitle.css('position', 'absolute');
  this.$yAxisTitle.css('width', width + 'px');
  this.$yAxisTitle.css('left', '0px');
  this.$yAxisTitle.css('top', '0px');

  this.$barsContainer.css('top', (this.$yAxisTitle.height() + 15) + 'px');

  return this;
};

BarChart.prototype.resizeContainer = function () {
  if (!this.$container) { return; }
  if (this.width) { this.$container.css('width', this.width + 'px'); }
  if (this.height) { this.$container.css('height', this.height + 'px'); }

  return this;
};

BarChart.prototype.recalculateSizes = function () {
  // Reset width and height if they changed or were never set
  this.innerWidth = this.$barsContainer.width();
  this.innerHeight = this.$barsContainer.height();

  // Recalculate bar width and spacing
  // Standard is bars are twice as large as spacing
  // Then we check for a cap on bar width
  var stdSpacing = this.innerWidth / (3 * this.numBars + 1)
    , stdBarWidth = 2 * stdSpacing
    , barWidth = this.maxBarWidth ? Math.min(stdBarWidth, this.maxBarWidth) : stdBarWidth
    , spacing =  (this.innerWidth - (this.numBars * barWidth)) / (this.numBars + 1)
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

  if (!d3.select(this.barsContainer).selectAll('div.bar').data(this.data, BarChart.statics.getId).exit().empty()) {
    initialDelay = this.transitionDuration;
  }

  // Transition old bars out
  d3.select(this.barsContainer).selectAll('div.bar').data(this.data, BarChart.statics.getId).exit()
    .transition().duration(this.transitionDuration)
    .style('height', '0px')
    .style('top', this.innerHeight + 'px')
    .remove()
    ;

  // Create new bars
  selection = d3.select(this.barsContainer).selectAll('div.bar').data(this.data, BarChart.statics.getId).enter().append('div')
    .attr('class', 'bar')
    .style('width', this.barWidth + 'px')
    .style('top', this.innerHeight + 'px')
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
  d3.select(this.barsContainer).selectAll('div.bar').data(this.data, BarChart.statics.getId)
    .transition().duration(this.transitionDuration).delay(initialDelay)
    .style('width', this.barWidth + 'px')
    .style('left', function(d, i) { return self._left(d, i) + 'px'; })
    .attr('data-description', function (d, i) { return d.description || ''; })
    ;

  // Second transition: vertical scaling
  d3.select(this.barsContainer).selectAll('div.bar').data(this.data, BarChart.statics.getId)
    .transition().duration(this.transitionDuration).delay(initialDelay + this.transitionDuration)
    .style('top', function(d, i) { return (self.innerHeight - self._height(d, i)) + 'px'; })
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

  d3.select(this.barsContainer).selectAll('div.ytick').data(ticks)
    .exit().remove();

  d3.select(this.barsContainer).selectAll('div.ytick').data(ticks)
    .enter().append('div').attr('class', 'ytick');

  d3.select(this.barsContainer).selectAll('div.ytick').data(ticks)
    .text(function (d) { return d; })
    .style('top', function(d, i) { return ((self.innerHeight - self._height(d, i)) - 6) + 'px'; })
    .style('right', (this.innerWidth + 10) + 'px')
    ;
};

// Position functions, with or without the 'px' suffix
BarChart.prototype._left = function (x, i) {
  return this.spacing + (i * (this.spacing + this.barWidth));
};
BarChart.prototype._width = function (x, i) {
  return this.barWidth;
};
BarChart.prototype._top = function (y, i) {
  return this.innerHeight - this._height(y, i);
};
BarChart.prototype._height = function (y, i) {
  // This will work whether y is a number or an object with a datum property
  return ((y.datum || y) - this.minY) / (this.maxY - this.minY) * this.innerHeight;
};
// Px counterparts
['left', 'width', 'top', 'height'].forEach(function (key) {
  BarChart.prototype[key + '_px'] = function (d, i) { return this['_' + key](d, i) + 'px'; };
});


BarChart.statics = {};
// _baseLeft and _baseHeight need to be added to the prototype of BarChart if no other plotting function is passed
BarChart.statics.getId = function (d)  { return d._id; };


// Tooltip management
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

  if ($target.data('description')) {
    tooltipHtml = '<div class="tooltip" id="' + id + '" style="position: fixed; left: ' + (event.pageX - 28) + 'px; top: ' + (event.pageY - 56) + 'px;">' + $target.data('description') + '</div>';
    $target.append(tooltipHtml);
  }
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
var bc = new BarChart({ container: "#graph1"
, useCustomScale: true
//, maxBarWidth: 20
, displayLabels: true
, showTooltips: true
});
bc.resizeContainer();
bc.withData([ { datum: 5, _id: "A" }
            , { datum: 12, _id: "B" }      
            , { datum: 4, _id: "C", description: "Some interesting text" }      
            , { datum: 7, _id: "D" }      
            , { datum: 1, _id: "E" }      
            , { datum: 6, _id: "F" }      
            , { datum: 7, _id: "G" }      
            ])/*.withScale({ minY: 0, maxY: 20 })*/.withYAxisTitle('Distance driven (km)').redraw();

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








