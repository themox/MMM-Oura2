# MMM-GoogleTasks

Module for the [MagicMirror²](https://github.com/MichMich/MagicMirror/) smart mirror.

Displays a user's Oura data in a chart.  Inspired by https://github.com/erchenger/MMM-Oura, but I was looking for a little more data.  Still a work in progress but feature requests and feedback are welcome.
<br><br>
This module uses a python backend, primarily through Pandas, to download the data from Oura.  On a request for update (on load, or on the pre-programmed interval), the javascript module sends a request to the python for updated data.  
The python downloads that data from Oura, processes through Pandas for data formatting and management, and then pushes back to the javascript in an easily parsable format.  On receipt, the javascript pushes that into a chart.js canvas, which
is then rendered by the getDom function when called.
<br><br>

* Which features would you like to see?<br>
* Which charts would you like to see?<br>


### Example
![Example of MMM-Oura2](images/sample.png?raw=true "Example screenshot")

### Dependencies

1. Chart.js
2. Python3, including the following modules/packages:
--Pandas<br>
--Numpy<br>
--Requests<br>

Assumes python3 is located at /usr/bin/python3


## Installation
To install the module, use your terminal to:
1. Navigate to your MagicMirror's modules folder. If you are using the default installation directory, use the command:<br />`cd ~/MagicMirror/modules`
2. Clone the module:<br />`git clone https://github.com/themox/MMM-Oura2.git`
3. Install Chart.js framework:<br />`npm install chart.js`
4. Ensure you have the correct Python version (3+) and libraries installed.

## Using the module

### MagicMirror² Configuration

To use this module, add the following configuration block to the modules array in the `config/config.js` file:
```js
var config = {
    modules: [
        ...
        {
            module: 'MMM-Oura2',
            header: "Oura Data",
            position: "top_left",
            config: {
		token: "",              // REQUIRED. your personal access token for Oura
                charts: ["heartrate"],  // Rwhich charts to display; currently one or both of ["heartrate", "scores"]; eventually to be several
                unit:  "weeks",         // one of [months, days, weeks]
                interval: 1,            // integer interval to combine with unit for length of time to get & display data
                ...
                // See below for detailed Configuration Options
            }
        },
        ...
    ]
}
```

### Configuration Options

| Option                  | Details
|------------------------ |--------------
| `token`                 | *Required* - Your Oura Personal Access token - see [Oura documentation](https://cloud.ouraring.com/docs/authentication)
| `charts`                | *Required* - Array of which charts to display. All charts will get the same style information from the below configuration options. <br><br> **Possible values:** `scores`  `heartrate` <br> **Default value:** `["scores"]`
| `unit`                  | *Required* - Combined with interval, amount of days to display in chart <br><br> **Possible values:** `months`  `weeks`  `days` <br> **Default value:** `weeks`
| `interval`              | *Required* - Integer number to combine with unit for number of days to display in chart (e.g. 1 weeks will give 7 days) <br> **Default value:** `1`
| `updateInterval`        | Interval at which content updates (Milliseconds); recommend keeping this large as it does not need updating that often <br><br> **Possible values:** `2000` - `86400000` <br> **Default value:** `10000 * 60 * 60` (60 minutes)
| `palette`               | One of four different color palettes to use when choosing line color. <br><br> **Possible values:** `0` - `3` <br> **Default value:** `0`
| `lineWeight`            | Integer line thickness for each series  <br><br> **Possible values:** `0` - `10` <br> **Default value:** `1`
| `dotWeight`             | Integer point size<br><br> **Possible values:** `0` - `10` <br> **Default value:** `3`
| `chartTextColor`        | Color of text on chart, including labels, legend, etc.  Conforms to [Chart.js Color styles](https://www.chartjs.org/docs/latest/general/colors.html) <br> **Default value:** `gray`
| `chartGridColor`        | Color of gridlines on chart, also conforms to [Chart.js Color styles](https://www.chartjs.org/docs/latest/general/colors.html) <br> **Default value:** `rgba(50, 50, 50, .8)`
| `fontSize`              | Integer font size for chart labels <br>**Default value:** `12`
| `fontFamily`            | Which font or font family to use for chart text; see [Chart.js fonts](https://www.chartjs.org/docs/latest/general/fonts.html)  <br>**Default value:** `Roboto Condensed`
| `legendPosition`        | Where on the chart to display the legend; conforms to [Chart.js legend styling](https://www.chartjs.org/docs/latest/configuration/legend.html#position)  <br>**Default value:** `bottom`
