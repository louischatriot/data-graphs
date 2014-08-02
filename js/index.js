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
BarChart.prototype.withXAxisTitle = function (title, width) {
  this.updateRightPanelWidth(width);

  if (!this.$xAxisTitle) {
    this.$container.append('<div class="x-axis-title">' + title + '</div>');
    this.$xAxisTitle = $(this.container + ' .x-axis-title');
  }

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

    if (this.useVerticalLabels) {
      d3.select(this.barsContainer).selectAll('div.label')
        .style('transform', 'rotate(90deg) translate(50%)')
        .style('text-align', 'left')
        ;
    }
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
  this.updateHorizontalLineHeight();

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

BarChart.prototype.updateRightPanelWidth = function (_width) {
  var width = _width || 150
    , formerInnerWidth = this.innerWidth;
    ;
  if (this.rightPanelWidth) { width = Math.max(width, this.rightPanelWidth); }
  if (width > this.$container.width()) { width = this.$container.width() / 4; }
  this.rightPanelWidth = width;

  this.$barsContainer.css('right', (this.rightPanelWidth + 15) + 'px');
  this.innerWidth = this.$barsContainer.width();

  if (this.innerWidth !== formerInnerWidth) {
    this.redraw();
  }
};

// For now only possible to add one line
BarChart.prototype.horizontalLine = function (y, text, width) {
  var self = this;

  this.updateRightPanelWidth();

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
    this.$container.append('<div class="horizontal-line-label">' + text + '</div>');
    this.$horizontalLineLabel = $(this.container + ' .horizontal-line-label');
    this.$horizontalLineLabel.css('position', 'absolute');
    this.$horizontalLineLabel.css('color', 'darkred');
    this.$horizontalLineLabel.css('width', this.rightPanelWidth + 'px');
    this.$horizontalLineLabel.css('right', '0px');
  }

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
    , tooltipHtml
    ;

  // Tooltip already shown
  if ($target.find('div.tooltip').length > 0) { return; }
  // Not on a bar, only on a label
  if (!$target.hasClass('bar')) { return; }

  if ($target.data('description')) {
    tooltipHtml = '<div class="tooltip" style="position: fixed; left: ' + (event.pageX - 28) + 'px; top: ' + (event.pageY - 56) + 'px;">' + $target.data('description') + '</div>';
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
var testData = JSON.parse('{"340AQW51":{"Nom du véhicule":"10 - C3 Bleue 340AQW51","Code VIN":"VF7FRKFVC28594905","Distance totale conduite":804.6,"Distance moyenne conduite par jour":36.6,"Distance moyenne des trajets":89.4,"Distance maximum d’un trajet":620.6,"Distance max conduite en un jour":620.6,"Nombre de trajets":9,"Nombre de trajets avec réservation":0,"Pourcentage de trajets par réservation":0,"Temps cumulé en trajet":36.5,"Taux d’utilisation":0.1},"AB306YD":{"Nom du véhicule":"11- C3 Bleue AB306YD","Code VIN":"VF7FRKFVC9A098886","Distance totale conduite":1311.4,"Distance moyenne conduite par jour":59.6,"Distance moyenne des trajets":655.7,"Distance maximum d’un trajet":1310.6,"Distance max conduite en un jour":55.3,"Nombre de trajets":2,"Nombre de trajets avec réservation":1,"Pourcentage de trajets par réservation":0.5,"Temps cumulé en trajet":210.5,"Taux d’utilisation":0.8},"AB294YD":{"Nom du véhicule":"12 - C3 Bleue AB294YD   ","Code VIN":"VF7FRKFVC9A098885","Distance totale conduite":0,"Distance moyenne conduite par jour":0,"Distance moyenne des trajets":0,"Distance maximum d’un trajet":0,"Distance max conduite en un jour":0,"Nombre de trajets":0,"Nombre de trajets avec réservation":0,"Pourcentage de trajets par réservation":0,"Temps cumulé en trajet":0,"Taux d’utilisation":0},"446AZM51":{"Nom du véhicule":"13 - C3 Bleue 446AZM51  sorti du parc","Code VIN":"","Distance totale conduite":3249.8,"Distance moyenne conduite par jour":147.7,"Distance moyenne des trajets":3249.8,"Distance maximum d’un trajet":3249.8,"Distance max conduite en un jour":31,"Nombre de trajets":1,"Nombre de trajets avec réservation":0,"Pourcentage de trajets par réservation":0,"Temps cumulé en trajet":253.7,"Taux d’utilisation":1},"345AQW51":{"Nom du véhicule":"14 - C3 Bleue 345AQW51","Code VIN":"","Distance totale conduite":497,"Distance moyenne conduite par jour":22.6,"Distance moyenne des trajets":71,"Distance maximum d’un trajet":191.2,"Distance max conduite en un jour":101.4,"Nombre de trajets":7,"Nombre de trajets avec réservation":0,"Pourcentage de trajets par réservation":0,"Temps cumulé en trajet":35.7,"Taux d’utilisation":0.1},"AB247YD":{"Nom du véhicule":"15 - C3 Bleue AB247YD","Code VIN":"VF7FRKFVC9A097896","Distance totale conduite":932.4,"Distance moyenne conduite par jour":42.4,"Distance moyenne des trajets":58.3,"Distance maximum d’un trajet":181.2,"Distance max conduite en un jour":188.4,"Nombre de trajets":16,"Nombre de trajets avec réservation":3,"Pourcentage de trajets par réservation":0.2,"Temps cumulé en trajet":49.6,"Taux d’utilisation":0.2},"564ARE51":{"Nom du véhicule":"16 - C3 Bleue 564ARE51","Code VIN":"VF7FRKFVC28688689","Distance totale conduite":1743.7,"Distance moyenne conduite par jour":79.3,"Distance moyenne des trajets":91.8,"Distance maximum d’un trajet":655.3,"Distance max conduite en un jour":232.5,"Nombre de trajets":19,"Nombre de trajets avec réservation":4,"Pourcentage de trajets par réservation":0.2,"Temps cumulé en trajet":114.5,"Taux d’utilisation":0.4},"AB256YD":{"Nom du véhicule":"17 - C3 Bleue AB256YD","Code VIN":"VF7FRKFVC9A096913","Distance totale conduite":1521.4,"Distance moyenne conduite par jour":69.2,"Distance moyenne des trajets":72.4,"Distance maximum d’un trajet":207.2,"Distance max conduite en un jour":240.6,"Nombre de trajets":21,"Nombre de trajets avec réservation":1,"Pourcentage de trajets par réservation":0,"Temps cumulé en trajet":79.9,"Taux d’utilisation":0.3},"347AQW51":{"Nom du véhicule":"18 - C3 Bleue 347AQW51","Code VIN":"","Distance totale conduite":737.9,"Distance moyenne conduite par jour":33.5,"Distance moyenne des trajets":46.1,"Distance maximum d’un trajet":117.7,"Distance max conduite en un jour":150.9,"Nombre de trajets":16,"Nombre de trajets avec réservation":1,"Pourcentage de trajets par réservation":0.1,"Temps cumulé en trajet":36.2,"Taux d’utilisation":0.1},"AB276YD":{"Nom du véhicule":"19 - C3 Bleue AB276YD","Code VIN":"VF7FRKFVC9A096911","Distance totale conduite":2278,"Distance moyenne conduite par jour":103.5,"Distance moyenne des trajets":162.7,"Distance maximum d’un trajet":1046.9,"Distance max conduite en un jour":374.2,"Nombre de trajets":14,"Nombre de trajets avec réservation":0,"Pourcentage de trajets par réservation":0,"Temps cumulé en trajet":76.6,"Taux d’utilisation":0.3},"244ANZ51":{"Nom du véhicule":"1 - C3 Bleue 244ANZ51","Code VIN":"VF7FRKFVC27331613","Distance totale conduite":141.6,"Distance moyenne conduite par jour":6.4,"Distance moyenne des trajets":47.2,"Distance maximum d’un trajet":77.5,"Distance max conduite en un jour":49.6,"Nombre de trajets":3,"Nombre de trajets avec réservation":0,"Pourcentage de trajets par réservation":0,"Temps cumulé en trajet":25.5,"Taux d’utilisation":0.1},"AB107XM":{"Nom du véhicule":"20 - C3 Bleue AB107XM  sorti du parc","Code VIN":"VF7FRKFVC9A09544","Distance totale conduite":2574.6,"Distance moyenne conduite par jour":117,"Distance moyenne des trajets":2574.6,"Distance maximum d’un trajet":2574.6,"Distance max conduite en un jour":27.4,"Nombre de trajets":1,"Nombre de trajets avec réservation":0,"Pourcentage de trajets par réservation":0,"Temps cumulé en trajet":145.4,"Taux d’utilisation":0.6},"341AQW51":{"Nom du véhicule":"21 - C3 Bleue 341AQW51","Code VIN":"","Distance totale conduite":583.2,"Distance moyenne conduite par jour":26.5,"Distance moyenne des trajets":32.4,"Distance maximum d’un trajet":192.4,"Distance max conduite en un jour":192.4,"Nombre de trajets":18,"Nombre de trajets avec réservation":0,"Pourcentage de trajets par réservation":0,"Temps cumulé en trajet":75.8,"Taux d’utilisation":0.3},"246ANZ51":{"Nom du véhicule":"22 - C3 Bleue 246ANZ51","Code VIN":"VF7FRKFVC27331622","Distance totale conduite":249.6,"Distance moyenne conduite par jour":11.3,"Distance moyenne des trajets":27.7,"Distance maximum d’un trajet":102.1,"Distance max conduite en un jour":102.1,"Nombre de trajets":9,"Nombre de trajets avec réservation":0,"Pourcentage de trajets par réservation":0,"Temps cumulé en trajet":25.1,"Taux d’utilisation":0.1},"230ANZ51":{"Nom du véhicule":"23 - C3 Bleue 230ANZ51","Code VIN":"","Distance totale conduite":1219.2,"Distance moyenne conduite par jour":55.4,"Distance moyenne des trajets":67.7,"Distance maximum d’un trajet":608.5,"Distance max conduite en un jour":223.5,"Nombre de trajets":18,"Nombre de trajets avec réservation":3,"Pourcentage de trajets par réservation":0.2,"Temps cumulé en trajet":66.7,"Taux d’utilisation":0.3},"441AZM51":{"Nom du véhicule":"24 - C3 Bleue 441AZM51 ","Code VIN":"","Distance totale conduite":1334.3,"Distance moyenne conduite par jour":60.6,"Distance moyenne des trajets":70.2,"Distance maximum d’un trajet":238.7,"Distance max conduite en un jour":225.1,"Nombre de trajets":19,"Nombre de trajets avec réservation":0,"Pourcentage de trajets par réservation":0,"Temps cumulé en trajet":59.9,"Taux d’utilisation":0.2},"237ANZ51":{"Nom du véhicule":"3 - C3 Bleue 237ANZ51","Code VIN":"","Distance totale conduite":1025,"Distance moyenne conduite par jour":46.6,"Distance moyenne des trajets":78.8,"Distance maximum d’un trajet":526.5,"Distance max conduite en un jour":211.9,"Nombre de trajets":13,"Nombre de trajets avec réservation":2,"Pourcentage de trajets par réservation":0.2,"Temps cumulé en trajet":50.6,"Taux d’utilisation":0.2},"AB266YD":{"Nom du véhicule":"4 - C3 Bleue AB266YD","Code VIN":"VF7FRKFVC9A098888","Distance totale conduite":469.7,"Distance moyenne conduite par jour":21.4,"Distance moyenne des trajets":26.1,"Distance maximum d’un trajet":111.1,"Distance max conduite en un jour":111.1,"Nombre de trajets":18,"Nombre de trajets avec réservation":0,"Pourcentage de trajets par réservation":0,"Temps cumulé en trajet":43,"Taux d’utilisation":0.2},"AB301YD":{"Nom du véhicule":"5 - C3 Bleue AB301YD","Code VIN":"VF7FRKFVC9A098887","Distance totale conduite":1886.1,"Distance moyenne conduite par jour":85.7,"Distance moyenne des trajets":110.9,"Distance maximum d’un trajet":536.5,"Distance max conduite en un jour":235.3,"Nombre de trajets":17,"Nombre de trajets avec réservation":1,"Pourcentage de trajets par réservation":0.1,"Temps cumulé en trajet":107.7,"Taux d’utilisation":0.4},"242ANZ51":{"Nom du véhicule":"6 - C3 Bleue 242ANZ51","Code VIN":"","Distance totale conduite":1247.4,"Distance moyenne conduite par jour":56.7,"Distance moyenne des trajets":138.6,"Distance maximum d’un trajet":407.9,"Distance max conduite en un jour":299.9,"Nombre de trajets":9,"Nombre de trajets avec réservation":0,"Pourcentage de trajets par réservation":0,"Temps cumulé en trajet":80,"Taux d’utilisation":0.3},"236ANZ51":{"Nom du véhicule":"8 - C3 Bleue 236ANZ51 ","Code VIN":"VF7FRKFVC27331614","Distance totale conduite":1206.8,"Distance moyenne conduite par jour":54.9,"Distance moyenne des trajets":54.9,"Distance maximum d’un trajet":390.8,"Distance max conduite en un jour":390.8,"Nombre de trajets":22,"Nombre de trajets avec réservation":1,"Pourcentage de trajets par réservation":0,"Temps cumulé en trajet":60.3,"Taux d’utilisation":0.2},"AD259AS":{"Nom du véhicule":"9 - C3 Bleue AD259AS  sorti du parc","Code VIN":"VF7FRKFVC9A093679","Distance totale conduite":1509.1,"Distance moyenne conduite par jour":68.6,"Distance moyenne des trajets":1509.1,"Distance maximum d’un trajet":1509.1,"Distance max conduite en un jour":16.1,"Nombre de trajets":1,"Nombre de trajets avec réservation":0,"Pourcentage de trajets par réservation":0,"Temps cumulé en trajet":145.4,"Taux d’utilisation":0.6},"CY-402-QB":{"Nom du véhicule":"Kangoo ZE CY-402-QB","Code VIN":"VF1FW0ZBC49537247","Distance totale conduite":178.5,"Distance moyenne conduite par jour":8.1,"Distance moyenne des trajets":35.7,"Distance maximum d’un trajet":71.3,"Distance max conduite en un jour":71.3,"Nombre de trajets":5,"Nombre de trajets avec réservation":0,"Pourcentage de trajets par réservation":0,"Temps cumulé en trajet":10.2,"Taux d’utilisation":0},"CY-766-QA":{"Nom du véhicule":"Kangoo ZE CY-766-QA","Code VIN":"VF1FWOZBC49537215","Distance totale conduite":353.7,"Distance moyenne conduite par jour":16.1,"Distance moyenne des trajets":25.3,"Distance maximum d’un trajet":61.4,"Distance max conduite en un jour":63.1,"Nombre de trajets":14,"Nombre de trajets avec réservation":8,"Pourcentage de trajets par réservation":0.6,"Temps cumulé en trajet":62.7,"Taux d’utilisation":0.2},"CZ-294-CP":{"Nom du véhicule":"Kangoo ZE CZ-294-CP","Code VIN":"VF1FW0ZBC49537261","Distance totale conduite":99.6,"Distance moyenne conduite par jour":4.5,"Distance moyenne des trajets":16.6,"Distance maximum d’un trajet":35.7,"Distance max conduite en un jour":35.7,"Nombre de trajets":6,"Nombre de trajets avec réservation":0,"Pourcentage de trajets par réservation":0,"Temps cumulé en trajet":11.2,"Taux d’utilisation":0},"CZ-305-YD":{"Nom du véhicule":"Kangoo ZE CZ-305-YD","Code VIN":"VF1FW0ZBC49954444","Distance totale conduite":176,"Distance moyenne conduite par jour":8,"Distance moyenne des trajets":16,"Distance maximum d’un trajet":49.7,"Distance max conduite en un jour":81.7,"Nombre de trajets":11,"Nombre de trajets avec réservation":0,"Pourcentage de trajets par réservation":0,"Temps cumulé en trajet":10,"Taux d’utilisation":0},"DB650KC":{"Nom du véhicule":"Megane Bleue DB650KC","Code VIN":"VF1BZ1A0749212137","Distance totale conduite":907.6,"Distance moyenne conduite par jour":41.3,"Distance moyenne des trajets":453.8,"Distance maximum d’un trajet":463.7,"Distance max conduite en un jour":205.9,"Nombre de trajets":2,"Nombre de trajets avec réservation":2,"Pourcentage de trajets par réservation":1,"Temps cumulé en trajet":79.9,"Taux d’utilisation":0.3}}');









var bc = new BarChart({ container: "#graph1"
, useCustomScale: true
//, maxBarWidth: 20
, displayLabels: true
, showTooltips: true
});
bc.resizeContainer().withScale({ minY: 0 });


function dataChanged() {
  var data = []
    , keys = Object.keys(testData)
    ;

  keys.forEach(function (k) {
    data.push({ datum: testData[k][currentDimension], _id: k });
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

  bc.withData(data);
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

// Manage dimension
var currentDimension = "Distance totale conduite";
$('.change-dimension').on('click', function (event) {
  var $target = $(event.target);

  currentDimension = $target.data('dimension');

  dataChanged();
});



// Init
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








