var PositionExportFilter = function() {

	this.djangoRootPath = "http://localhost:8000/admin";
	// this.djangoRootPath = "http://localhost:8000";
	$(document).ready(function() {
	    exportFilter.populateElement('.driverFilter', '/driver_filter')
	    exportFilter.populateElement('.taxiFilter', '/taxi_filter')
	    exportFilter.populateElement('.dateFilter', '/date_filter')
	});
}

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
        url: exportFilter.djangoRootPath + url,
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
			$(selector + ' .time').timepicker({
		        'timeFormat': 'H:i:s'
		    });

		    $(selector + ' .date').datepicker({
			    'closeText': 'schliessen',
			    'prevText': 'zurück',
			    'nextText': 'weiter',
			    'currentText': 'Heute',
			    'dateFormat': 'dd.mm.yy',
			    'monthNames': ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'],
			    'dayNames': ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag','Samstag'],
			    'dayNamesMin': ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
		        'autoclose': true,
				onClose: function(selectedDate) {
					// $(this).parent().find(".time").trigger("click");
					$(".to_date").datepicker("option", "minDate", selectedDate);
					return $(".to_date").datepicker("show");
				}		    
			});

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

PositionExportFilter.prototype.formatDateTime = function(timeString) {
	var date = this.parseDateTimeString(timeString);
	return ('0' + date.getDate()).slice(-2) + '.'
		+ ('0' + (date.getMonth()+1)).slice(-2) + '.'
		+ date.getFullYear() + " "
		+ ('0' + date.getHours()).slice(-2) + ':'
		+ ('0' + date.getMinutes()).slice(-2) + ':'
		+ ('0' + date.getSeconds()).slice(-2);
}

PositionExportFilter.prototype.parseDateTimeString = function(timeString) {
	var dateArray = timeString.split(/[\s,T,\-,\.,\:]/);
	return new Date(
		parseInt(dateArray[0], 10), 
		parseInt(dateArray[1], 10)-1, 
		parseInt(dateArray[2], 10), 
		parseInt(dateArray[3], 10), 
		parseInt(dateArray[4], 10), 
		parseInt(dateArray[5], 0)
		);
}

var exportFilter = new PositionExportFilter();