Module.register("MMM-Oura2", {
	// Default module config.
	defaults: {
                token: "", 		// REQUIRED. your personal access token for Oura
                charts: ["scores"],     // which charts to display; currently one or both of ["heartrate", "scores"]; eventually to be several
                unit:  "weeks",         // one of [months, days, weeks]
                interval: 1,            // integer interval to combine with unit for length of time to get & display data
		updateInterval: 10000*60*60, // default to every 60 minutes (ms)
		palette: 0,		// an integer between 0 and 3
                lineWeight: 1,		// determines line plot thickness; all line plots are the same thickness
                dotWeight: 3,		// determines plot point size
		// https://www.chartjs.org/docs/latest/general/colors.html Colors from the chart
                chartTextColor: 'gray',
                chartGridColor: 'rgba(50, 50, 50, .8)',
		fontSize: 12, // https://www.chartjs.org/docs/latest/general/fonts.html
		fontFamily: 'Roboto Condensed',
		legendPosition: 'bottom', // https://www.chartjs.org/docs/latest/configuration/legend.html#position
	},
	
	// Define required scripts
	getScripts: function () {
		return ["moment.js"];
	},

	// Define required scripts.
	getStyles: function () {
		return ["MMM-Oura2.css", "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.8.0/chart.js"];
	},

	// Define start sequence
	start: function() {
		var self = this;

		self.chartdata;

		Log.info("Starting module: " + this.name);
		self.chart_wrapper;
		self.loaded = false;


		// enforce ranges on configurable integer values in order to ensure somewhat sane behavior
		if (self.config.updateInterval < 2000) {
			self.config.updateInterval = 2000;
		} else if (self.config.updateInterval > 86400000) {
			self.config.updateInterval = 86400000;
		}

		if (self.config.lineWeight < 0) {
			self.config.lineWeight = 0;
		} else if (self.config.lineWeight > 10) {
			self.config.lineWeight = 10;
		}

		if (self.config.palette < 0) {
			self.config.palette = 0;
		} else if (self.config.palette > 3) {
			self.config.palette = 3;
		}

		if (self.config.dotWeight < 0) {
			self.config.dotWeight = 0;
		} else if (self.config.dotWeight > 10) {
			self.config.dotWeight = 10;
		}



		// Create repeating call to node_helper get list
		setInterval(function() {
			self.sendSocketNotification("REQUEST_UPDATE", self.config);
		}, self.config.updateInterval);

		self.sendSocketNotification("MODULE_READY", self.config);
	},

	socketNotificationReceived: function(notification, payload) {
		var self = this;

		console.log("oura got notification: " + notification);

		if (notification === "UPDATE_CHART") {
			console.log("got chart update.");
			// Handle new data
			self.loaded = true;
			self.chartdata = payload;

			if (self.data) {
				self.updateDom();
			}
		}
	},

	getDom: function() {

		console.log("MMM-Oura2: rendering chart dom update.");

		var self = this;

		var wrapper = document.createElement('div');
		wrapper.className = "container ";
		wrapper.className += this.config.tableClass;

		wrapper.id = "oura";

		if (!self.data || !self.loaded) {
			console.log("MMM-Oura2:  No data loaded, tried to load dom.");
			wrapper.innerHTML = "Loading Oura Data.";
			return wrapper;
		}

		var ouradata = self.chartdata;

		// Build array of different chart types which are currently configured and can be set via the config
		//  type member should match the chart_types type
		var chart_types = [
		{
			type: "heartrate",
			columns: ["hr_min_bpm", "hr_max_bpm", "hr_mean_bpm"],
			labelColumns: ["Min HR", "Max HR", "Mean HR"],
			chartTitle: "Heart Rate Data",
			id: "hr",
			yAxisLabel: "BPM",
		},
		{
			type: "scores",
    			columns: ["activity_score", "sleep_score", "readiness_score"],
			labelColumns: ["Activity", "Sleep", "Readiness"],
    			chartTitle: "Overall Readiness",
			id: "score",
			max: 100,
			yAxisLabel: "Score",
		},
		{
			type: "sleep",
			columns: ["sleep_duration", "sleep_efficiency", "sleep_onset_latency", "sleep_score"],
			labelColumns: ["Duration (Min)", "EFficiency (%)", "Onset Latency (Min)", "Score"],
			yAxes: ["y1", "y", "y", "y"],
			chartTitle: "Sleep Analysis",
			id: "sleep",
			yAxisLabel: "Score",
			yAxisLabel2: "Duration",
		},
		];

		var canvas_list = document.createElement("ul");

		for (chart_type of chart_types) {

			if (!self.config.charts.includes(chart_type.type)) {
				continue;
			}

			columns = chart_type.columns;
			chartTitle = chart_type.chartTitle;
			chartId = chart_type.id;

			// uses some of the items from https://www.chartjs.org/docs/latest/configuration/elements.html#types
			// but not all of them display well, so have removed some.
			// if more than 4 shapes, they will repeat, but colors will be different based on palette algorithm
	    		var shape_opts = ["circle", "rectRounded", "rectRot", "triangle"];
			
			var chartdiv = document.createElement('div');
	                chartdiv.className = "chart ";
        	        chartdiv.className += this.config.tableClass;

			var canvas = document.createElement('canvas');
			canvas.id = chartId;
			var ctx = canvas.getContext('2d');

			Chart.defaults.font.size = self.config.fontSize;
			Chart.defaults.font.family = self.config.fontFamily;

			// basic chart; will add options later
			const myChart = new Chart(ctx, {
				type: 'line',
    				data: {}, 
				options: {
					scales: {
            					y: {
                					beginAtZero: false,
            					}
        				}
    				}
			});

			// Per Chart configurable variables
	    		var yAxisLabel = chart_type.yAxisLabel;
	    		var maxYAxis = chart_type.max;
	    		var hasMax = false;
			var labelColumns = chart_type.labelColumns;

    			// configurable options
    			var palette = self.config.palette;
    			var lineWeight = self.config.lineWeight;
    			var dotWeight = self.config.dotWeight;
			var chartTextColor = self.config.chartTextColor;
			var chartGridColor = self.config.chartGridColor;

			// housekeeping variables for loop and chart building

    			var finalLabels = [];

   			var hasLabels = false;

    			var numColumns = columns.length;
    			var colNum = 0;

			var datasets = [];

			// get every series we want to display in this chart
			// more efficient way to do it would be to loop through columns 
	    		for (column in ouradata) {

				var dataSet = {};

        			colNum ++;


        			if (!columns.includes(column)) {
            				// Only pick up the columns we want
            				continue;
        			}

				// Text label for this data series on the legend
				if (labelColumns) {
					dataSet.label = labelColumns[columns.indexOf(column)];
				} else {
					dataSet.label = column;
				}


        			data = [];
        			labels = [];

        			for (key in ouradata[column]) {

            				if (!hasLabels) {
                				labels.push(key);
            				}

	            			data.push(ouradata[column][key]);
        			}

        			if (!hasLabels) {
            				finalLabels = this.processLabels(labels);

            				hasLabels = true;
        			}

				dataArray = [];
				colorArray = [];
        			for (item in data) {
        	    			if (data[item] == 0) {
						dataArray.push(null);
            				} else {
						dataArray.push(data[item]);
            				}
					colorArray.push(this.buildColorStr(colNum, palette));
        			}

				dataSet.data = dataArray;
				dataSet.borderWidth = lineWeight;
				dataSet.borderColor = colorArray;

        			// automate shapes based on choices; rotate through options
        			shp = colNum % shape_opts.length;
        			shape_sel = shape_opts[shp];

				dataSet.pointStyle = shape_sel;
				dataSet.pointRadius = dotWeight;
				dataSet.pointBackgroundColor = this.buildColorStr(colNum, palette);

				datasets.push(dataSet);


				// Set up multiple axes for the graphs if required
				if (chart_type.yAxes) {
					dataSet.yAxisID = chart_type.yAxes[columns.indexOf(column)];
				}

    			}

			// Build out remaining chart options
			var options = {
    				scales: {
        				y: {
	            				beginAtZero: false,
						display: true,
						type: "linear",
						position: "left",
            					title: {
                    					text: yAxisLabel,
                    					display: true,
                    					color: chartTextColor,
                				},
                				ticks: {
                    					color: chartTextColor,
                				},
                				grid: {
                    					color: chartGridColor,
                				},
        				},
                                        y1: {
						display: false,
						type: "linear",
                                                beginAtZero: false,
						position: "right",
                                                title: {
                                                        display: false,
                                                        color: chartTextColor,
                                                },
                                                ticks: {
                                                        color: chartTextColor,
                                                },
                                                grid: {
							drawOnChartArea: false,
                                                },
                                        },
        				x: {
            					ticks: {
                					color: chartTextColor,
            					},
            					grid: {
                					color: chartGridColor,
            					},
        				},
    				},
    				plugins: {
        				legend: {
            					labels: {
                					usePointStyle: true,
                					color: chartTextColor,
            					},
            					position: self.config.legendPosition,
        				},
       	 				title: {
            					display: true,
            					color: chartTextColor,
            					text: chartTitle,
            					padding: {
                					top: 0,
                					bottom: 10,
            					}
        				},
    				}
			};

			if (chart_type.yAxes) {
				options.scales.y1.display = true;
			}

                        if (chart_type.max) {
				// Set a y-axis max value if the chart-type should have it.
				options.scales.y.max = chart_type.max;
                                //console.log("Chart y max = " + chart_type.max);
                        }

			if (chart_type.yAxisLabel2) {
				options.scales.y1.title.text = chart_type.yAxisLabel2;
				options.scales.y1.title.display = true;
			}

			myChart.data.labels = finalLabels;	// X values
			myChart.data.datasets = datasets;	// all the individual datasets
			myChart.options = options;

			// Add to list; using CSS to remove bullets but this ensures the charts are separated from each other and not displayed on top of one another.
			var canvas_list_item = document.createElement("li");
			canvas_list_item.appendChild(canvas);
			canvas_list.appendChild(canvas_list_item);
		}

		wrapper.appendChild(canvas_list);

		return wrapper;
	},


	// Takes an array of date labels in the format YYYY-MM-DD and coverts to be somewhat abbreviated.
	// but allows you to see delineation between months
	processLabels: function(labels) {

	    for (let i = 0; i < labels.length; i++) {
	        label = "";
	        label_array = labels[i].split("-");

	        if (i == 0) {
		    // @TODO: Do we want year for this chart?  Next line provides year.
	            //label += label_array[0] + "/" + label_array[1] + "/"; 
	            label += parseInt(label_array[1]) + "/";
	        }

	        if (label_array[2] == "01" && i > 0) {
	            // Only display month on first day of the month to simplify chart legend
        	    label +=  parseInt(label_array[1]) + "/";
	        }

        	label += parseInt(label_array[2]);

	        labels[i] = label;

	    }

	    return labels;
	},

	buildColorStr: function(colNum, pal) {

		var palette_size = 5;


		var palette = [
			// https://www.pinterest.com/pin/522980575481583144/
                        // I'm colorblind, so relying on someone else to make colors for me.
			// Below allwos 5 distinct colors in 4 unique palettes
                        // summer
                        "rgba(35, 110, 150, .8)",
                        "rgba(21, 178, 211, .8)",
                        "rgba(255, 215, 0, .8)",
                        "rgba(243, 135, 47, .8)",
                        "rgba(255, 89, 143, .8)",

                        // winter
                        "rgba(66, 104, 124, .8)",
                        "rgba(132, 165, 184, .8)",
                        "rgba(179, 218, 241, .8)",
                        "rgba(203, 203, 203, .8)",
                        "rgba(112, 117, 113, .8)",

                        // spring
                        "rgba(243, 168, 188, .8)",
                        "rgba(245, 173, 148, .8)",
                        "rgba(255, 241, 166, .8)",
                        "rgba(180, 249, 165, .8)",
                        "rgba(158, 231, 245, .8)",

                        // autumn
                        "rgba(96, 60, 20, .8)",
                        "rgba(156, 39, 6, .8)",
                        "rgba(212, 91, 18, .8)",
                        "rgba(243, 188, 46, .8)",
                        "rgba(95, 84, 38, .8)",
		];

		// colNum is 1-indexed
		var ind = ((colNum - 1) + (pal * palette_size)) % palette.length;

		return palette[ind];
	},

});
