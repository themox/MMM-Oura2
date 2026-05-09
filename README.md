# MMM-Oura2

Module for the [MagicMirror²](https://github.com/MichMich/MagicMirror/) smart mirror.

Displays a user's Oura data in a chart.  Inspired by https://github.com/erchenger/MMM-Oura, but I was looking for a little more data.  Still a work in progress but feature requests and feedback are welcome.
<br><br>
When I first made this app, I had just learned Pandas and was very excited about it, so I made this based on a Python backend using Pandas as the primary library to organize the data.  These days I realize that is an unnecessary layer on top of the MagicMirror framework, so I have reworked the app to be exclusively in JS.  I still love Pandas but realize it may not be The Tool for all situations.
<br><br>
This version of MMM-Oura2 drops the Python backend entirely, uses the Oura V2 api, but still uses the old Personal Authentication Token style to log in and get your data.  I'll work on supporting the new authentication style shortly, but for now continue to use your original PAT which should still work per the Oura API documentation.
<br>

I don't get the sense many people are using this beyond me, but if you are and like it, I am interested in your feedback about how I can make it better.

* Which features would you like to see?<br>
* Which charts would you like to see?<br>

### Example
![Example of MMM-Oura2](images/sample.png?raw=true "Example screenshot")

### Dependencies

1. Chart.js
2. axios
3. lodash
4. luxon
5. yargs

## Installation
To install the module, use your terminal to:
1. Navigate to your MagicMirror's modules folder. If you are using the default installation directory, use the command:<br />`cd ~/MagicMirror/modules`
2. Clone the module:<br />`git clone https://github.com/themox/MMM-Oura2.git`
3. Install required apis:<br />`npm install axios lodash luxon yargs chart.js --save`

## Testing
If you want to just do a quick test to see if your personal token is working, you can use this command at the command line, from the MMM-Oura2 directory.  `oura_data.js` effectively replaces the old Python script and allows you to query your data directly.
`node oura_data.js --token="YOUR_TOKEN_HERE" --interval=7 --unit=days --activity=all`

## Update Instructions

From the MagicMirror\modules\MMM-Oura2\ path:
1. Pull down the latest files from GitHub:<br/>`git pull` 
2. Ensure required apis installed:<br />`npm install axios lodash luxon yargs chart.js --save`
3. ensure the packages are up-to-date<br/> `npm update`

## Using the module

### MagicMirror² Configuration

To use this module, add the following configuration block to the modules array in the `config/config.js` file:
```js
{
    module: 'MMM-Oura2',
    header: "Oura Data",
    position: "top_left",
    config: {
        token: "",              // REQUIRED. your personal access token for Oura
        charts: ["heartrate"],  // Which charts to display; currently one or more of ["sleep", "heartrate", "scores", "activity"];
        unit:  "weeks",         // One of [months, days, weeks]
        interval: 1,            // Integer interval to combine with unit for length of time to get & display data
        ...
        // See below for detailed Configuration Options
    }
},
```

### Configuration Options

| Option                  | Details
|------------------------ |--------------
| `token`                 | *Required* - Your Oura Personal Access token - see [Oura documentation](https://cloud.ouraring.com/docs/authentication)
| `charts`                | *Required* - Array of which charts to display. All charts will get the same style information from the below configuration options. <br> **Possible values:** `sleep`  `scores`  `heartrate`  `activity`<br> **Default value:** `["scores"]`
| `unit`                  | *Required* - Combined with interval, amount of days to display in chart <br> **Possible values:** `months`  `weeks`  `days` <br> **Default value:** `weeks`
| `interval`              | *Required* - Integer number to combine with unit for number of days to display in chart (e.g. 1 weeks will give 7 days) <br> **Default value:** `1`
| `updateInterval`        | Interval at which content updates (milliseconds); recommend keeping this large as it does not need updating that often <br> **Possible values:** `2000` - `86400000` <br> **Default value:** `10000 * 60 * 60` (60 minutes)
| `palette`               | One of four different color palettes to use when choosing line color. <br> **Possible values:** `0` - `3` <br> **Default value:** `0`
| `lineWeight`            | Integer line thickness for each series  <br><br> **Possible values:** `0` - `10` <br> **Default value:** `1`
| `dotWeight`             | Integer point size<br><br> **Possible values:** `0` - `10` <br> **Default value:** `3`
| `chartTextColor`        | Color of text on chart, including labels, legend, etc.  Conforms to [Chart.js Color styles](https://www.chartjs.org/docs/latest/general/colors.html) <br> **Default value:** `gray`
| `chartGridColor`        | Color of gridlines on chart, also conforms to [Chart.js Color styles](https://www.chartjs.org/docs/latest/general/colors.html) <br> **Default value:** `rgba(50, 50, 50, .8)`
| `fontSize`              | Integer font size for chart labels <br>**Default value:** `12`
| `fontFamily`            | Which font or font family to use for chart text; see [Chart.js fonts](https://www.chartjs.org/docs/latest/general/fonts.html)  <br>**Default value:** `Roboto Condensed`
| `legendPosition`        | Where on the chart to display the legend; conforms to [Chart.js legend styling](https://www.chartjs.org/docs/latest/configuration/legend.html#position)  <br>**Default value:** `bottom`


Oura's new API requires me to show you the below items as well:

## Terms of Use:

This code is provided free of charge, to be used at your own risk.  It is intended to provide you some control over your own data, to be used in the MagicMirror framework.

## Privacy Policy:

This is intended to be a local/self-hosted integration for you to access and view your own Oura data.
I do not collect or receive your Oura data.

You must create your own Oura API key to use this module.

## Developer commands
- `node --run lint` - Run linting checks.
- `node --run lint:fix` - Fix automatically fixable linting errors.