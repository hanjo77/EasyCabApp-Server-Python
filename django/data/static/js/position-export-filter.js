/*!
 * position-export-filter.js v1.0
 * Class to control the position export filter of the EasyCab Application
 * on Google Maps.
 */

 var PositionExportFilter = function() {
	$(document).ready(function() {
	    exportFilter.populateElement('.driverFilter', '/driver_filter')
	    exportFilter.populateElement('.taxiFilter', '/taxi_filter')
	    exportFilter.populateElement('.dateFilter', '/date_filter')
	});
}

/**
 * Populates container with snippet from URL
 * @param {String} selector CSS-selector of the container to populate
 * @param {String} url URL of snippet
 */
PositionExportFilter.prototype.populateElement = function(selector, url) {
	var selectedTaxis = [];
    $('.taxiFilter input:checked').each(function() {
    	selectedTaxis.push($(this).val());
    });
    if (selectedTaxis.length <= 0) selectedTaxis = null;
	var selectedDrivers = [];
    $('.driverFilter input:checked').each(function() {
    	selectedDrivers.push($(this).val());
    });
    if (selectedDrivers.length <= 0) selectedDrivers = null;
    var startDate = $('#startDate').val();
    if (startDate && startDate != '') {
    	var startTime = $('#startTime').val() + ' ';
    	if (startTime != '') {
    		startDate += startTime;
    	}
    	else {
    		startDate += '00:00:00';
    	}
    }
    else {
    	startDate = null;
    }
    var endDate = $('#endDate').val();
    if (endDate && endDate != '') {
    	var endTime = $('#endTime').val() + ' ';
    	if (endTime != '') {
    		endDate += endTime;
    	}
    	else {
    		endDate += '23:59:59';
    	}
    }
    else {
    	endDate = null;
    }
	$.ajax({
        url: EasyCabUtil.adminRootPath + url,
        method: "GET",
        data: {
        	'taxi': selectedTaxis,
        	'driver': selectedDrivers,
        	'startDate': startDate,
        	'endDate': endDate
        },
        success: function( data ) {
        	$(selector).html(data);
        	$(selector + " .selectAll").click(function(event) {
        		$target = $(event.target);
        		var name = $target.attr("name");
        		if ($target.is(':checked')) {
        			$(selector + " [name='" + name + "']:not(:checked)").trigger("click");
        		}
        		else {
        			$(selector + " [name='" + name + "']:checked").trigger("click");
        		}
        	});
        	EasyCabUtil.initDateTimePicker(selector);
			switch(selector) {
				case '.driverFilter':
					$(selector + ' input').click(function(event) {
				    	exportFilter.populateElement('.taxiFilter', '/taxi_filter')
				    });
					break;
				case '.taxiFilter':
					$(selector + ' input').click(function(event) {
				    	exportFilter.populateElement('.driverFilter', '/driver_filter')
				    });
					break;
				case '.dateFilter':
					$(selector + ' input').change(function(event) {
				    	exportFilter.populateElement('.taxiFilter', '/taxi_filter')
				    	exportFilter.populateElement('.driverFilter', '/driver_filter')
				    });
					break;
			}

		    if ($('.taxiFilter input').length <= 1) {
				selectedTaxis = null;
				$('.exportFilter input[type="submit"]').hide();
			}
			else {
				$('.exportFilter input[type="submit"]').show();
			}
        }
    });	
}

// Instanciate PositionExportFilter object
var exportFilter = new PositionExportFilter();