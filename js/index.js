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
  this.$barsContainer.css('right', '0px');
  this.$barsContainer.css('top', '0px');
  this.$barsContainer.css('bottom', '30px');

  this.scale = {};
  this.scale.minY = opts.minY;
  this.scale.maxY = opts.maxY;

  this.transitionDuration = opts.transitionDuration || 500;

  // Define listeners
  // We use loosely coupling between data/parameter changes and drawing to keep code simple
  // The drawback is that certain functions may be called mlore than necessary but their execution time is negligible anyway
  this.on('change.width', this.resizeContainer);
  this.on('change.width', this.recalculateSizes);

  this.on('change.height', this.resizeContainer);
  this.on('change.height', this.recalculateSizes);

  this.on('change.data', this.recalculateSizes);

  this.on('change.rightPanelWidth', this.recalculateSizes);
  this.on('change.rightPanelWidth', this.redraw);

  this.on('redraw', this.redrawYAxis);
  this.on('redraw', this.updateHorizontalLineHeight);
}

// Pubsub
// Don't use event names starting with '__', they are use internally for listener unbinding
// One message and one only can be passed, but it can be any object so that's not a restriction
BarChart.prototype.on = function (evt, action) {
  if (!this.events) { this.events = {}; }
  if (!this.events[evt]) {
    this.events[evt] = [];
    this.events['__' + evt] = -1;
  }
  this.events['__' + evt] += 1;
  this.events[evt].push({ id: this.events['__' + evt], listener: action });

  return this.events['__' + evt];
};
BarChart.prototype.trigger = function (evt, msg) {
  if (!this.events[evt]) { return; }

  for (var i = 0; i < this.events[evt].length; i += 1) {
    this.events[evt][i].listener.call(this, msg);
  }
};


BarChart.prototype.withWidth = function (width) {
  this.width = width;
  this.trigger('change.width');
  return this;
};
BarChart.prototype.withHeight = function (height) {
  this.height = height;
  this.trigger('change.height');
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

  this.trigger('change.data');

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
    this.$container.append('<div class="y-axis-title"></div>');
    this.$yAxisTitle = $(this.container + ' .y-axis-title');
  }

  this.$yAxisTitle.html(title);
  this.$yAxisTitle.css('position', 'absolute');
  this.$yAxisTitle.css('width', width + 'px');
  this.$yAxisTitle.css('left', '0px');
  this.$yAxisTitle.css('top', '0px');

  this.$barsContainer.css('top', (this.$yAxisTitle.height() + 15) + 'px');

  return this;
};
BarChart.prototype.withXAxisTitle = function (title, width) {
  this.updateRightPanelWidth(width);

  if (!this.$xAxisTitle) {
    this.$container.append('<div class="x-axis-title"><div>');
    this.$xAxisTitle = $(this.container + ' .x-axis-title');
  }

  this.$xAxisTitle.html(title);
  this.$xAxisTitle.css('position', 'absolute');
  this.$xAxisTitle.css('width', this.rightPanelWidth + 'px');
  this.$xAxisTitle.css('right', '0px');
  this.$xAxisTitle.css('bottom', (parseInt(this.$barsContainer.css('bottom'), 10) - 5) + 'px');

  return this;
};
BarChart.prototype.useVerticalLabels = function () {
  this.useVerticalLabels = true;
  return this;
};

BarChart.prototype.resizeContainer = function () {
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

  return this;
};

// Main drawing function that assumes we are in a clean state (same number of bars as data)
// and which leaves a clean state
BarChart.prototype.redraw = function () {
  var self = this
    , initialDelay = 0
    , selection
    ;

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
    .style('width', function (d, i) { return self._width(d, i) + 'px'; })
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

    if (this.useVerticalLabels) {
      d3.select(this.barsContainer).selectAll('div.label')
        .style('transform', 'rotate(90deg) translate(50%)')
        .style('text-align', 'left')
        .style('white-space', 'nowrap')
        ;
    }
  }
 
  // First transition: horizontal rearrangement
  // Also put data for tooltip
  d3.select(this.barsContainer).selectAll('div.bar').data(this.data, BarChart.statics.getId)
    .transition().duration(this.transitionDuration).delay(initialDelay)
    .style('width', function (d, i) { return self._width(d, i) + 'px'; })
    .style('left', function(d, i) { return self._left(d, i) + 'px'; })
    .attr('data-description', function (d, i) { return d.description || ''; })
    ;

  // Second transition: vertical scaling
  d3.select(this.barsContainer).selectAll('div.bar').data(this.data, BarChart.statics.getId)
    .transition().duration(this.transitionDuration).delay(initialDelay + this.transitionDuration)
    .style('top', function(d, i) { return self._top(d, i) + 'px'; })
    .style('height', function(d, i) { return self._height(d, i) + 'px'; })
    ;

  if (this.showTooltips) {
    $(this.container + ' div.bar').on('mouseover', showToolTip);
    $(this.container + ' div.bar').on('mouseleave', removeToolTip);
  }

  this.trigger('redraw');
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

BarChart.prototype.updateRightPanelWidth = function (_width) {
  var width = _width || 150
    , formerInnerWidth = this.innerWidth;
    ;

  if (this.rightPanelWidth) { width = Math.max(width, this.rightPanelWidth); }
  if (width > this.$container.width() > 4) { width = this.$container.width() / 4; }
  this.rightPanelWidth = width;

  this.$barsContainer.css('right', (this.rightPanelWidth + 15) + 'px');

  this.trigger('change.rightPanelWidth');
};

// For now only possible to add one line
BarChart.prototype.horizontalLine = function (y, text, width) {
  var self = this;

  this.updateRightPanelWidth(width);

  // Create the line and its label
  if (!this.$horizontalLine) {
    this.$barsContainer.append('<div class="horizontal-line"></div>');
    this.$horizontalLine = $(this.barsContainer + ' .horizontal-line');
    this.$horizontalLine.css('position', 'absolute');
    this.$horizontalLine.css('height', '2px');
    this.$horizontalLine.css('background-color', 'darkred');
    this.$horizontalLine.css('right', '0px');
    this.$horizontalLine.css('left', '0px');
    this.$horizontalLine.css('z-index', '2000');   // Must be higher than the bars
  }
  if (!this.$horizontalLineLabel) {
    this.$container.append('<div class="horizontal-line-label"></div>');
    this.$horizontalLineLabel = $(this.container + ' .horizontal-line-label');
    this.$horizontalLineLabel.css('position', 'absolute');
    this.$horizontalLineLabel.css('color', 'darkred');
    this.$horizontalLineLabel.css('width', this.rightPanelWidth + 'px');
    this.$horizontalLineLabel.css('right', '0px');
  }

  this.$horizontalLineLabel.html(text);
  this.updateHorizontalLineHeight(y);

  return this;
};

BarChart.prototype.updateHorizontalLineHeight = function (y) {
  var self = this;

  if (!this.$horizontalLine) { return; }

  // If line height is given, bind it to the elements
  if (y) {
    d3.select(this.barsContainer).selectAll('div.horizontal-line').data([y]);
    d3.select(this.container).selectAll('div.horizontal-line-label').data([y]);
  }

  // Animate from current state (can be no line) to new position
  d3.select(this.barsContainer).selectAll('div.horizontal-line')
    .transition().duration(this.transitionDuration)
    .style('top', function (d) { return self._top(d) + 'px'; })
    ;
  d3.select(this.container).selectAll('div.horizontal-line-label')
    .transition().duration(this.transitionDuration)
    .style('top', function (d) {
      var labelTop = self._top(d) + parseInt(self.$barsContainer.css('top'), 10) - 10;
      if (self.$xAxisTitle) {
        labelTop = Math.min(labelTop, self.$container.height() - parseInt(self.$xAxisTitle.css('bottom'), 10) - self.$xAxisTitle.height() - self.$horizontalLineLabel.height() - 10);
      }
      return labelTop + 'px';
    })
    ;
};

// Position functions
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
  return ((y.datum !== undefined ? y.datum : y) - this.minY) / (this.maxY - this.minY) * this.innerHeight;
};


BarChart.statics = {};
// _baseLeft and _baseHeight need to be added to the prototype of BarChart if no other plotting function is passed
BarChart.statics.getId = function (d)  { return d._id; };


// Tooltip management
function showToolTip (event) {
  var $target = $(event.target)
    , tooltipHtml
    ;

  // Tooltip already shown
  if ($target.find('div.tooltip').length > 0) { return; }
  // Not on a bar, only on a label
  if (!$target.hasClass('bar')) { return; }

  // Using $.attr and not $.data since $.data seems to remember the piece of data even when it's unbound, causing tooltips to show for a dimension where we don't want any
  if ($target.attr('data-description')) {
    tooltipHtml = '<div class="tooltip" style="position: fixed; left: ' + (event.pageX - 28) + 'px; top: ' + (event.pageY - 60) + 'px;">' + $target.attr('data-description') + '</div>';
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

  $tooltip = $parent.find('div.tooltip');

  $tooltip.remove();
}



// ===== TESTS =====
//var testData = JSON.parse('{"340AQW51":{"Nom du véhicule":"10 - C3 Bleue 340AQW51","Code VIN":"VF7FRKFVC28594905","Distance totale conduite":804.6,"Distance moyenne conduite par jour":36.6,"Distance moyenne des trajets":89.4,"Distance maximum d’un trajet":620.6,"Distance max conduite en un jour":620.6,"Nombre de trajets":9,"Nombre de trajets avec réservation":0,"Pourcentage de trajets par réservation":0,"Temps cumulé en trajet":36.5,"Taux d’utilisation":0.1},"AB306YD":{"Nom du véhicule":"11- C3 Bleue AB306YD","Code VIN":"VF7FRKFVC9A098886","Distance totale conduite":1311.4,"Distance moyenne conduite par jour":59.6,"Distance moyenne des trajets":655.7,"Distance maximum d’un trajet":1310.6,"Distance max conduite en un jour":55.3,"Nombre de trajets":2,"Nombre de trajets avec réservation":1,"Pourcentage de trajets par réservation":0.5,"Temps cumulé en trajet":210.5,"Taux d’utilisation":0.8},"AB294YD":{"Nom du véhicule":"12 - C3 Bleue AB294YD   ","Code VIN":"VF7FRKFVC9A098885","Distance totale conduite":0,"Distance moyenne conduite par jour":0,"Distance moyenne des trajets":0,"Distance maximum d’un trajet":0,"Distance max conduite en un jour":0,"Nombre de trajets":0,"Nombre de trajets avec réservation":0,"Pourcentage de trajets par réservation":0,"Temps cumulé en trajet":0,"Taux d’utilisation":0},"446AZM51":{"Nom du véhicule":"13 - C3 Bleue 446AZM51  sorti du parc","Code VIN":"","Distance totale conduite":3249.8,"Distance moyenne conduite par jour":147.7,"Distance moyenne des trajets":3249.8,"Distance maximum d’un trajet":3249.8,"Distance max conduite en un jour":31,"Nombre de trajets":1,"Nombre de trajets avec réservation":0,"Pourcentage de trajets par réservation":0,"Temps cumulé en trajet":253.7,"Taux d’utilisation":1},"345AQW51":{"Nom du véhicule":"14 - C3 Bleue 345AQW51","Code VIN":"","Distance totale conduite":497,"Distance moyenne conduite par jour":22.6,"Distance moyenne des trajets":71,"Distance maximum d’un trajet":191.2,"Distance max conduite en un jour":101.4,"Nombre de trajets":7,"Nombre de trajets avec réservation":0,"Pourcentage de trajets par réservation":0,"Temps cumulé en trajet":35.7,"Taux d’utilisation":0.1},"AB247YD":{"Nom du véhicule":"15 - C3 Bleue AB247YD","Code VIN":"VF7FRKFVC9A097896","Distance totale conduite":932.4,"Distance moyenne conduite par jour":42.4,"Distance moyenne des trajets":58.3,"Distance maximum d’un trajet":181.2,"Distance max conduite en un jour":188.4,"Nombre de trajets":16,"Nombre de trajets avec réservation":3,"Pourcentage de trajets par réservation":0.2,"Temps cumulé en trajet":49.6,"Taux d’utilisation":0.2},"564ARE51":{"Nom du véhicule":"16 - C3 Bleue 564ARE51","Code VIN":"VF7FRKFVC28688689","Distance totale conduite":1743.7,"Distance moyenne conduite par jour":79.3,"Distance moyenne des trajets":91.8,"Distance maximum d’un trajet":655.3,"Distance max conduite en un jour":232.5,"Nombre de trajets":19,"Nombre de trajets avec réservation":4,"Pourcentage de trajets par réservation":0.2,"Temps cumulé en trajet":114.5,"Taux d’utilisation":0.4},"AB256YD":{"Nom du véhicule":"17 - C3 Bleue AB256YD","Code VIN":"VF7FRKFVC9A096913","Distance totale conduite":1521.4,"Distance moyenne conduite par jour":69.2,"Distance moyenne des trajets":72.4,"Distance maximum d’un trajet":207.2,"Distance max conduite en un jour":240.6,"Nombre de trajets":21,"Nombre de trajets avec réservation":1,"Pourcentage de trajets par réservation":0,"Temps cumulé en trajet":79.9,"Taux d’utilisation":0.3},"347AQW51":{"Nom du véhicule":"18 - C3 Bleue 347AQW51","Code VIN":"","Distance totale conduite":737.9,"Distance moyenne conduite par jour":33.5,"Distance moyenne des trajets":46.1,"Distance maximum d’un trajet":117.7,"Distance max conduite en un jour":150.9,"Nombre de trajets":16,"Nombre de trajets avec réservation":1,"Pourcentage de trajets par réservation":0.1,"Temps cumulé en trajet":36.2,"Taux d’utilisation":0.1},"AB276YD":{"Nom du véhicule":"19 - C3 Bleue AB276YD","Code VIN":"VF7FRKFVC9A096911","Distance totale conduite":2278,"Distance moyenne conduite par jour":103.5,"Distance moyenne des trajets":162.7,"Distance maximum d’un trajet":1046.9,"Distance max conduite en un jour":374.2,"Nombre de trajets":14,"Nombre de trajets avec réservation":0,"Pourcentage de trajets par réservation":0,"Temps cumulé en trajet":76.6,"Taux d’utilisation":0.3},"244ANZ51":{"Nom du véhicule":"1 - C3 Bleue 244ANZ51","Code VIN":"VF7FRKFVC27331613","Distance totale conduite":141.6,"Distance moyenne conduite par jour":6.4,"Distance moyenne des trajets":47.2,"Distance maximum d’un trajet":77.5,"Distance max conduite en un jour":49.6,"Nombre de trajets":3,"Nombre de trajets avec réservation":0,"Pourcentage de trajets par réservation":0,"Temps cumulé en trajet":25.5,"Taux d’utilisation":0.1},"AB107XM":{"Nom du véhicule":"20 - C3 Bleue AB107XM  sorti du parc","Code VIN":"VF7FRKFVC9A09544","Distance totale conduite":2574.6,"Distance moyenne conduite par jour":117,"Distance moyenne des trajets":2574.6,"Distance maximum d’un trajet":2574.6,"Distance max conduite en un jour":27.4,"Nombre de trajets":1,"Nombre de trajets avec réservation":0,"Pourcentage de trajets par réservation":0,"Temps cumulé en trajet":145.4,"Taux d’utilisation":0.6},"341AQW51":{"Nom du véhicule":"21 - C3 Bleue 341AQW51","Code VIN":"","Distance totale conduite":583.2,"Distance moyenne conduite par jour":26.5,"Distance moyenne des trajets":32.4,"Distance maximum d’un trajet":192.4,"Distance max conduite en un jour":192.4,"Nombre de trajets":18,"Nombre de trajets avec réservation":0,"Pourcentage de trajets par réservation":0,"Temps cumulé en trajet":75.8,"Taux d’utilisation":0.3},"246ANZ51":{"Nom du véhicule":"22 - C3 Bleue 246ANZ51","Code VIN":"VF7FRKFVC27331622","Distance totale conduite":249.6,"Distance moyenne conduite par jour":11.3,"Distance moyenne des trajets":27.7,"Distance maximum d’un trajet":102.1,"Distance max conduite en un jour":102.1,"Nombre de trajets":9,"Nombre de trajets avec réservation":0,"Pourcentage de trajets par réservation":0,"Temps cumulé en trajet":25.1,"Taux d’utilisation":0.1},"230ANZ51":{"Nom du véhicule":"23 - C3 Bleue 230ANZ51","Code VIN":"","Distance totale conduite":1219.2,"Distance moyenne conduite par jour":55.4,"Distance moyenne des trajets":67.7,"Distance maximum d’un trajet":608.5,"Distance max conduite en un jour":223.5,"Nombre de trajets":18,"Nombre de trajets avec réservation":3,"Pourcentage de trajets par réservation":0.2,"Temps cumulé en trajet":66.7,"Taux d’utilisation":0.3},"441AZM51":{"Nom du véhicule":"24 - C3 Bleue 441AZM51 ","Code VIN":"","Distance totale conduite":1334.3,"Distance moyenne conduite par jour":60.6,"Distance moyenne des trajets":70.2,"Distance maximum d’un trajet":238.7,"Distance max conduite en un jour":225.1,"Nombre de trajets":19,"Nombre de trajets avec réservation":0,"Pourcentage de trajets par réservation":0,"Temps cumulé en trajet":59.9,"Taux d’utilisation":0.2},"237ANZ51":{"Nom du véhicule":"3 - C3 Bleue 237ANZ51","Code VIN":"","Distance totale conduite":1025,"Distance moyenne conduite par jour":46.6,"Distance moyenne des trajets":78.8,"Distance maximum d’un trajet":526.5,"Distance max conduite en un jour":211.9,"Nombre de trajets":13,"Nombre de trajets avec réservation":2,"Pourcentage de trajets par réservation":0.2,"Temps cumulé en trajet":50.6,"Taux d’utilisation":0.2},"AB266YD":{"Nom du véhicule":"4 - C3 Bleue AB266YD","Code VIN":"VF7FRKFVC9A098888","Distance totale conduite":469.7,"Distance moyenne conduite par jour":21.4,"Distance moyenne des trajets":26.1,"Distance maximum d’un trajet":111.1,"Distance max conduite en un jour":111.1,"Nombre de trajets":18,"Nombre de trajets avec réservation":0,"Pourcentage de trajets par réservation":0,"Temps cumulé en trajet":43,"Taux d’utilisation":0.2},"AB301YD":{"Nom du véhicule":"5 - C3 Bleue AB301YD","Code VIN":"VF7FRKFVC9A098887","Distance totale conduite":1886.1,"Distance moyenne conduite par jour":85.7,"Distance moyenne des trajets":110.9,"Distance maximum d’un trajet":536.5,"Distance max conduite en un jour":235.3,"Nombre de trajets":17,"Nombre de trajets avec réservation":1,"Pourcentage de trajets par réservation":0.1,"Temps cumulé en trajet":107.7,"Taux d’utilisation":0.4},"242ANZ51":{"Nom du véhicule":"6 - C3 Bleue 242ANZ51","Code VIN":"","Distance totale conduite":1247.4,"Distance moyenne conduite par jour":56.7,"Distance moyenne des trajets":138.6,"Distance maximum d’un trajet":407.9,"Distance max conduite en un jour":299.9,"Nombre de trajets":9,"Nombre de trajets avec réservation":0,"Pourcentage de trajets par réservation":0,"Temps cumulé en trajet":80,"Taux d’utilisation":0.3},"236ANZ51":{"Nom du véhicule":"8 - C3 Bleue 236ANZ51 ","Code VIN":"VF7FRKFVC27331614","Distance totale conduite":1206.8,"Distance moyenne conduite par jour":54.9,"Distance moyenne des trajets":54.9,"Distance maximum d’un trajet":390.8,"Distance max conduite en un jour":390.8,"Nombre de trajets":22,"Nombre de trajets avec réservation":1,"Pourcentage de trajets par réservation":0,"Temps cumulé en trajet":60.3,"Taux d’utilisation":0.2},"AD259AS":{"Nom du véhicule":"9 - C3 Bleue AD259AS  sorti du parc","Code VIN":"VF7FRKFVC9A093679","Distance totale conduite":1509.1,"Distance moyenne conduite par jour":68.6,"Distance moyenne des trajets":1509.1,"Distance maximum d’un trajet":1509.1,"Distance max conduite en un jour":16.1,"Nombre de trajets":1,"Nombre de trajets avec réservation":0,"Pourcentage de trajets par réservation":0,"Temps cumulé en trajet":145.4,"Taux d’utilisation":0.6},"CY-402-QB":{"Nom du véhicule":"Kangoo ZE CY-402-QB","Code VIN":"VF1FW0ZBC49537247","Distance totale conduite":178.5,"Distance moyenne conduite par jour":8.1,"Distance moyenne des trajets":35.7,"Distance maximum d’un trajet":71.3,"Distance max conduite en un jour":71.3,"Nombre de trajets":5,"Nombre de trajets avec réservation":0,"Pourcentage de trajets par réservation":0,"Temps cumulé en trajet":10.2,"Taux d’utilisation":0},"CY-766-QA":{"Nom du véhicule":"Kangoo ZE CY-766-QA","Code VIN":"VF1FWOZBC49537215","Distance totale conduite":353.7,"Distance moyenne conduite par jour":16.1,"Distance moyenne des trajets":25.3,"Distance maximum d’un trajet":61.4,"Distance max conduite en un jour":63.1,"Nombre de trajets":14,"Nombre de trajets avec réservation":8,"Pourcentage de trajets par réservation":0.6,"Temps cumulé en trajet":62.7,"Taux d’utilisation":0.2},"CZ-294-CP":{"Nom du véhicule":"Kangoo ZE CZ-294-CP","Code VIN":"VF1FW0ZBC49537261","Distance totale conduite":99.6,"Distance moyenne conduite par jour":4.5,"Distance moyenne des trajets":16.6,"Distance maximum d’un trajet":35.7,"Distance max conduite en un jour":35.7,"Nombre de trajets":6,"Nombre de trajets avec réservation":0,"Pourcentage de trajets par réservation":0,"Temps cumulé en trajet":11.2,"Taux d’utilisation":0},"CZ-305-YD":{"Nom du véhicule":"Kangoo ZE CZ-305-YD","Code VIN":"VF1FW0ZBC49954444","Distance totale conduite":176,"Distance moyenne conduite par jour":8,"Distance moyenne des trajets":16,"Distance maximum d’un trajet":49.7,"Distance max conduite en un jour":81.7,"Nombre de trajets":11,"Nombre de trajets avec réservation":0,"Pourcentage de trajets par réservation":0,"Temps cumulé en trajet":10,"Taux d’utilisation":0},"DB650KC":{"Nom du véhicule":"Megane Bleue DB650KC","Code VIN":"VF1BZ1A0749212137","Distance totale conduite":907.6,"Distance moyenne conduite par jour":41.3,"Distance moyenne des trajets":453.8,"Distance maximum d’un trajet":463.7,"Distance max conduite en un jour":205.9,"Nombre de trajets":2,"Nombre de trajets avec réservation":2,"Pourcentage de trajets par réservation":1,"Temps cumulé en trajet":79.9,"Taux d’utilisation":0.3}}');
var testData = JSON.parse('{"340AQW51":{"vehicleName":"10 - C3 Bleue 340AQW51","vin":"VF7FRKFVC28594905","totalDistance":804.6,"averageDistancePerDay":36.6,"averageRideDistance":89.4,"maxRideDistance":620.6,"maxDailyDistance":620.6,"rides":9,"ridesWithBookings":0,"ridesWithBookingsRate":0,"timeInRide":36.5,"usageRate":0.1},"AB306YD":{"vehicleName":"11- C3 Bleue AB306YD","vin":"VF7FRKFVC9A098886","totalDistance":1311.4,"averageDistancePerDay":59.6,"averageRideDistance":655.7,"maxRideDistance":1310.6,"maxDailyDistance":55.3,"rides":2,"ridesWithBookings":1,"ridesWithBookingsRate":0.5,"timeInRide":210.5,"usageRate":0.8},"AB294YD":{"vehicleName":"12 - C3 Bleue AB294YD   ","vin":"VF7FRKFVC9A098885","totalDistance":0,"averageDistancePerDay":0,"averageRideDistance":0,"maxRideDistance":0,"maxDailyDistance":0,"rides":0,"ridesWithBookings":0,"ridesWithBookingsRate":0,"timeInRide":0,"usageRate":0},"446AZM51":{"vehicleName":"13 - C3 Bleue 446AZM51  sorti du parc","vin":"","totalDistance":3249.8,"averageDistancePerDay":147.7,"averageRideDistance":3249.8,"maxRideDistance":3249.8,"maxDailyDistance":31,"rides":1,"ridesWithBookings":0,"ridesWithBookingsRate":0,"timeInRide":253.7,"usageRate":1},"345AQW51":{"vehicleName":"14 - C3 Bleue 345AQW51","vin":"","totalDistance":497,"averageDistancePerDay":22.6,"averageRideDistance":71,"maxRideDistance":191.2,"maxDailyDistance":101.4,"rides":7,"ridesWithBookings":0,"ridesWithBookingsRate":0,"timeInRide":35.7,"usageRate":0.1},"AB247YD":{"vehicleName":"15 - C3 Bleue AB247YD","vin":"VF7FRKFVC9A097896","totalDistance":932.4,"averageDistancePerDay":42.4,"averageRideDistance":58.3,"maxRideDistance":181.2,"maxDailyDistance":188.4,"rides":16,"ridesWithBookings":3,"ridesWithBookingsRate":0.2,"timeInRide":49.6,"usageRate":0.2},"564ARE51":{"vehicleName":"16 - C3 Bleue 564ARE51","vin":"VF7FRKFVC28688689","totalDistance":1743.7,"averageDistancePerDay":79.3,"averageRideDistance":91.8,"maxRideDistance":655.3,"maxDailyDistance":232.5,"rides":19,"ridesWithBookings":4,"ridesWithBookingsRate":0.2,"timeInRide":114.5,"usageRate":0.4},"AB256YD":{"vehicleName":"17 - C3 Bleue AB256YD","vin":"VF7FRKFVC9A096913","totalDistance":1521.4,"averageDistancePerDay":69.2,"averageRideDistance":72.4,"maxRideDistance":207.2,"maxDailyDistance":240.6,"rides":21,"ridesWithBookings":1,"ridesWithBookingsRate":0,"timeInRide":79.9,"usageRate":0.3},"347AQW51":{"vehicleName":"18 - C3 Bleue 347AQW51","vin":"","totalDistance":737.9,"averageDistancePerDay":33.5,"averageRideDistance":46.1,"maxRideDistance":117.7,"maxDailyDistance":150.9,"rides":16,"ridesWithBookings":1,"ridesWithBookingsRate":0.1,"timeInRide":36.2,"usageRate":0.1},"AB276YD":{"vehicleName":"19 - C3 Bleue AB276YD","vin":"VF7FRKFVC9A096911","totalDistance":2278,"averageDistancePerDay":103.5,"averageRideDistance":162.7,"maxRideDistance":1046.9,"maxDailyDistance":374.2,"rides":14,"ridesWithBookings":0,"ridesWithBookingsRate":0,"timeInRide":76.6,"usageRate":0.3},"244ANZ51":{"vehicleName":"1 - C3 Bleue 244ANZ51","vin":"VF7FRKFVC27331613","totalDistance":141.6,"averageDistancePerDay":6.4,"averageRideDistance":47.2,"maxRideDistance":77.5,"maxDailyDistance":49.6,"rides":3,"ridesWithBookings":0,"ridesWithBookingsRate":0,"timeInRide":25.5,"usageRate":0.1},"AB107XM":{"vehicleName":"20 - C3 Bleue AB107XM  sorti du parc","vin":"VF7FRKFVC9A09544","totalDistance":2574.6,"averageDistancePerDay":117,"averageRideDistance":2574.6,"maxRideDistance":2574.6,"maxDailyDistance":27.4,"rides":1,"ridesWithBookings":0,"ridesWithBookingsRate":0,"timeInRide":145.4,"usageRate":0.6},"341AQW51":{"vehicleName":"21 - C3 Bleue 341AQW51","vin":"","totalDistance":583.2,"averageDistancePerDay":26.5,"averageRideDistance":32.4,"maxRideDistance":192.4,"maxDailyDistance":192.4,"rides":18,"ridesWithBookings":0,"ridesWithBookingsRate":0,"timeInRide":75.8,"usageRate":0.3},"246ANZ51":{"vehicleName":"22 - C3 Bleue 246ANZ51","vin":"VF7FRKFVC27331622","totalDistance":249.6,"averageDistancePerDay":11.3,"averageRideDistance":27.7,"maxRideDistance":102.1,"maxDailyDistance":102.1,"rides":9,"ridesWithBookings":0,"ridesWithBookingsRate":0,"timeInRide":25.1,"usageRate":0.1},"230ANZ51":{"vehicleName":"23 - C3 Bleue 230ANZ51","vin":"","totalDistance":1219.2,"averageDistancePerDay":55.4,"averageRideDistance":67.7,"maxRideDistance":608.5,"maxDailyDistance":223.5,"rides":18,"ridesWithBookings":3,"ridesWithBookingsRate":0.2,"timeInRide":66.7,"usageRate":0.3},"441AZM51":{"vehicleName":"24 - C3 Bleue 441AZM51 ","vin":"","totalDistance":1334.3,"averageDistancePerDay":60.6,"averageRideDistance":70.2,"maxRideDistance":238.7,"maxDailyDistance":225.1,"rides":19,"ridesWithBookings":0,"ridesWithBookingsRate":0,"timeInRide":59.9,"usageRate":0.2},"237ANZ51":{"vehicleName":"3 - C3 Bleue 237ANZ51","vin":"","totalDistance":1025,"averageDistancePerDay":46.6,"averageRideDistance":78.8,"maxRideDistance":526.5,"maxDailyDistance":211.9,"rides":13,"ridesWithBookings":2,"ridesWithBookingsRate":0.2,"timeInRide":50.6,"usageRate":0.2},"AB266YD":{"vehicleName":"4 - C3 Bleue AB266YD","vin":"VF7FRKFVC9A098888","totalDistance":469.7,"averageDistancePerDay":21.4,"averageRideDistance":26.1,"maxRideDistance":111.1,"maxDailyDistance":111.1,"rides":18,"ridesWithBookings":0,"ridesWithBookingsRate":0,"timeInRide":43,"usageRate":0.2},"AB301YD":{"vehicleName":"5 - C3 Bleue AB301YD","vin":"VF7FRKFVC9A098887","totalDistance":1886.1,"averageDistancePerDay":85.7,"averageRideDistance":110.9,"maxRideDistance":536.5,"maxDailyDistance":235.3,"rides":17,"ridesWithBookings":1,"ridesWithBookingsRate":0.1,"timeInRide":107.7,"usageRate":0.4},"242ANZ51":{"vehicleName":"6 - C3 Bleue 242ANZ51","vin":"","totalDistance":1247.4,"averageDistancePerDay":56.7,"averageRideDistance":138.6,"maxRideDistance":407.9,"maxDailyDistance":299.9,"rides":9,"ridesWithBookings":0,"ridesWithBookingsRate":0,"timeInRide":80,"usageRate":0.3},"236ANZ51":{"vehicleName":"8 - C3 Bleue 236ANZ51 ","vin":"VF7FRKFVC27331614","totalDistance":1206.8,"averageDistancePerDay":54.9,"averageRideDistance":54.9,"maxRideDistance":390.8,"maxDailyDistance":390.8,"rides":22,"ridesWithBookings":1,"ridesWithBookingsRate":0,"timeInRide":60.3,"usageRate":0.2},"AD259AS":{"vehicleName":"9 - C3 Bleue AD259AS  sorti du parc","vin":"VF7FRKFVC9A093679","totalDistance":1509.1,"averageDistancePerDay":68.6,"averageRideDistance":1509.1,"maxRideDistance":1509.1,"maxDailyDistance":16.1,"rides":1,"ridesWithBookings":0,"ridesWithBookingsRate":0,"timeInRide":145.4,"usageRate":0.6},"CY-402-QB":{"vehicleName":"Kangoo ZE CY-402-QB","vin":"VF1FW0ZBC49537247","totalDistance":178.5,"averageDistancePerDay":8.1,"averageRideDistance":35.7,"maxRideDistance":71.3,"maxDailyDistance":71.3,"rides":5,"ridesWithBookings":0,"ridesWithBookingsRate":0,"timeInRide":10.2,"usageRate":0},"CY-766-QA":{"vehicleName":"Kangoo ZE CY-766-QA","vin":"VF1FWOZBC49537215","totalDistance":353.7,"averageDistancePerDay":16.1,"averageRideDistance":25.3,"maxRideDistance":61.4,"maxDailyDistance":63.1,"rides":14,"ridesWithBookings":8,"ridesWithBookingsRate":0.6,"timeInRide":62.7,"usageRate":0.2},"CZ-294-CP":{"vehicleName":"Kangoo ZE CZ-294-CP","vin":"VF1FW0ZBC49537261","totalDistance":99.6,"averageDistancePerDay":4.5,"averageRideDistance":16.6,"maxRideDistance":35.7,"maxDailyDistance":35.7,"rides":6,"ridesWithBookings":0,"ridesWithBookingsRate":0,"timeInRide":11.2,"usageRate":0},"CZ-305-YD":{"vehicleName":"Kangoo ZE CZ-305-YD","vin":"VF1FW0ZBC49954444","totalDistance":176,"averageDistancePerDay":8,"averageRideDistance":16,"maxRideDistance":49.7,"maxDailyDistance":81.7,"rides":11,"ridesWithBookings":0,"ridesWithBookingsRate":0,"timeInRide":10,"usageRate":0},"DB650KC":{"vehicleName":"Megane Bleue DB650KC","vin":"VF1BZ1A0749212137","totalDistance":907.6,"averageDistancePerDay":41.3,"averageRideDistance":453.8,"maxRideDistance":463.7,"maxDailyDistance":205.9,"rides":2,"ridesWithBookings":2,"ridesWithBookingsRate":1,"timeInRide":79.9,"usageRate":0.3}}');


var headers = {
  licensePlate: { name: 'License plate', yAxisTitle: 'License plate' }
, vehicleName: { name: 'Vehicle name', yAxisTitle: 'Vehicle name' }
, vin: { name: 'VIN', yAxisTitle: 'VIN' }
, totalDistance: { name: 'Total distance driven', yAxisTitle: 'Total distance driven (km)' }
, averageDistancePerDay: { name: 'Average distance per day', yAxisTitle: 'Average distance per day (km)' }
, averageRideDistance: { name: 'Average ride distance', yAxisTitle: 'Average ride distance (km)' }
, maxRideDistance: { name: 'Max ride distance', yAxisTitle: 'Max ride distance (km)' }
, maxDailyDistance: { name: 'Max daily distance', yAxisTitle: 'Max daily distance (km)' }
, rides: { name: 'Number of rides', yAxisTitle: 'Number of rides' }
, ridesWithBookings: { name: 'Number of rides with bookings', yAxisTitle: 'Number of rides with bookings' }
, ridesWithBookingsRate: { name: 'Rate of rides with bookings', yAxisTitle: 'Rate of rides with bookings' }
, timeInRide: { name: 'Time in ride', yAxisTitle: 'Time spent in a ride (hours)' }
, usageRate: { name: 'Usage rate', yAxisTitle: 'Usage rate' }
};







function dataChanged() {
  var data = []
    , keys = Object.keys(testData)
    , average = 0
    ;

  keys.forEach(function (k) {
    var toPush = { datum: testData[k][currentDimension]
              , _id: k
              };

    // Description depends on the quantity that's graphed
    // Should be parametrized and templatized
    switch (currentDimension) {
      case 'totalDistance':
      case 'averageDistancePerDay':
        toPush.description = '<b>' + k + '</b><br>Total: ' + testData[k].totalDistance + ' kms<br>Average per day: ' + testData[k].averageDistancePerDay + ' kms';
        break;

      case 'averageRideDistance':
        toPush.description = '<b>' + k + '</b><br>Average ride distance: ' + testData[k].averageRideDistance + ' kms';
        break;

      case 'maxRideDistance':
        toPush.description = '<b>' + k + '</b><br>Maximum ride distance: ' + testData[k].maxRideDistance + ' kms';
        break;

      case 'timeInRide':
      case 'usageRate':
        toPush.description = '<b>' + k + '</b><br>Total time in use: ' + testData[k].timeInRide + ' hours<br>Usage rate: ' + (testData[k].usageRate * 100) + ' %';
        break;
    }

    data.push(toPush);
  });

  if (currentSort === 'alpha') {
    data.sort(function (a, b) {
      if (a._id > b._id) {
        return 1;
      } else {
        return -1;
      }
    });
  } else {
    data.sort(function(a, b) {
      return b.datum - a.datum;
    });
  }

  data.forEach(function (d) {
    average += d.datum;
  });
  average /= data.length;

  bc.withData(data);
  bc.withYAxisTitle(headers[currentDimension].yAxisTitle);
  bc.horizontalLine(average, 'Average: ' + average);
  bc.redraw();
}



// Manage sort
var currentSort = 'alpha';
$('#data-sort').on('click', function () {
  if (currentSort === 'alpha') {
    currentSort = 'lts';
    $('#data-sort').attr('value', 'Alphabetically');
  } else {
    currentSort = 'alpha';
    $('#data-sort').attr('value', 'Largest to lowest');
  }

  dataChanged();
});

// Manage dimensions
["totalDistance", "averageDistancePerDay", "averageRideDistance", "maxRideDistance", "maxDailyDistance", "rides", "ridesWithBookings", "ridesWithBookingsRate", "timeInRide", "usageRate"].forEach(function (k) {
  $('#dimensions').append('<input type="button" class="change-dimension" data-dimension="' + k + '" value="' + headers[k].name + '">');
});
var currentDimension = "totalDistance";
$('.change-dimension').on('click', function (event) {
  var $target = $(event.target);

  currentDimension = $target.data('dimension');

  dataChanged();
});



// Init
var bc = new BarChart({ container: "#graph1"
, useCustomScale: true
//, maxBarWidth: 20
, displayLabels: true
, showTooltips: true
});
bc.withWidth(1200).withScale({ minY: 0 });


dataChanged();




//bc.withData([ { datum: 5, _id: "AB 103 XD" }
            //, { datum: 12, _id: "BB 103 XD" }
            //, { datum: 4, _id: "CB 103 XD", description: "Some interesting text" }      
            //, { datum: 7, _id: "DB 103 XD", description: "Some other text" }
            //, { datum: 1, _id: "EB 103 XD" }
            //, { datum: 6, _id: "FB 103 XD" }
            //, { datum: 7, _id: "GB 103 XD" }
            //])[>.withScale({ minY: 0, maxY: 20 })<].withYAxisTitle('Distance driven (km)').useVerticalLabels();

//bc.redraw();
//bc.horizontalLine(5, 'average');


//$("#test").on('click', (function () { var count = 0; return function () {
  //if (count === 0) {
    //bc.withData([ { datum: 4, _id: "HB 103 XD" }
                //, { datum: 2, _id: "DB 103 XD" }
                //, { datum: 17, _id: "CB 103 XD" }
                //, { datum: 16, _id: "IB 103 XD" }
                //, { datum: 0, _id: "EB 103 XD" }
                //, { datum: 5, _id: "FB 103 XD" }
                //, { datum: 10, _id: "BB 103 XD" }
                //, { datum: 12, _id: "GB 103 XD" }
                //, { datum: 18, _id: "AB 103 XD" }
                //]);

    //bc.redraw();
  //}

  //if (count === 1) {
    //bc.withData([ { datum: 4, _id: "BB 103 XD" }
                //, { datum: 2, _id: "DB 103 XD" }
                //, { datum: 16, _id: "IB 103 XD" }
                //, { datum: 0, _id: "EB 103 XD" }
                //, { datum: 10, _id: "HB 103 XD" }
                //, { datum: 18, _id: "AB 103 XD" }
                //]);

    //bc.redraw();
//bc.horizontalLine(8, 'average');
  //}

  //count += 1;
//}})());








