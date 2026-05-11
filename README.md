# MMM-Oura2

Module for the [MagicMirror²](https://github.com/MagicMirrorOrg/MagicMirror/) smart mirror.

Displays a user's Oura data in a chart.  Inspired by [MMM-Oura](https://github.com/erchenger/MMM-Oura), but I was looking for a little more data.  Still a work in progress but feature requests and feedback are welcome.
<br><br>
When I first made this app, I had just learned Pandas and was very excited about it, so I made this based on a Python backend using Pandas as the primary library to organize the data.  These days I realize that is an unnecessary layer on top of the MagicMirror² framework, so I have reworked the app to be exclusively in JS.  I still love Pandas but realize it may not be The Tool for all situations.
<br><br>
This version of MMM-Oura2 drops the Python backend entirely, uses the Oura V2 api, and now uses the new OAuth2 workflow.  If you still have a PAT and don't want to update to the OAuth2 method, you can use the older commit, `891df51`.  I won't be updating that method anymore, though, since Oura has moved to this new style.  All future updates to functionality and features will use OAuth2.
<br>

I don't get the sense many people are using this beyond me, but if you are and like it, I am interested in your feedback about how I can make it better.

* Which features would you like to see?<br>
* Which charts would you like to see?<br>

### Example

![Example of MMM-Oura2](images/sample.png?raw=true "Example screenshot")

### Dependencies

1. Chart.js
2. luxon
3. yargs

## Installation

To install the module, use your terminal to:
1. Navigate to your MagicMirror²'s modules folder. If you are using the default installation directory, use the command:<br />`cd ~/MagicMirror/modules`
2. Clone the module:<br />`git clone https://github.com/themox/MMM-Oura2.git`
3. Install required apis:<br />`npm install`

## OAuth2 Workflow Setup
MMM-Oura2 uses OAuth2 and requires a one-time (ish) authorization step.  This is the new required mechanism from the Oura developer site.  Follow these instructions after installation in order to set this up on your machine.

1. Create an Oura API application
* Create an app at [the new Oura Developer site](https://developer.ouraring.com/applications).
* Configure redirect URL (use this hard-coded one): `http://localhost:53682/callback`
* For both the Privacy Policy and Terms of service, I think you can just use the URL to this GitHub page.  It works for me; someone will have to let me know if it doesn't work for them.
* After you save the app, copy the created `Client ID` and `Client Secret` to use for the next step.
2. Create an OAuth credentials file
* In your base MMM-Oura2 folder, create `oura_credentials.json`.
<br/>`touch oura_credentials.json`.
* Then paste in the following:<br/>

```js
{
  "installed": {
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "redirect_uri": "http://localhost:53682/callback"
  }
}
```
<br/>
Use the Client ID and Client Secret you got from your app page here.  Note that the URL is the same one you used in the step above when you created your app.

3. Run one-time OAuth Authentication
* Execute this command from your MMM-Oura2 folder:<br/> `node get_oura_token.js`
* The script will:
    - Print an authorization URL
    - Ask you to open it in a browser
    - Redirect to a localhost URL that will fail (that's ok)
    - Copy the full redirected URL from the browser URL window back into the terminal at the prompt given.
* This creates a new file, `oura_auth.json`

4. Configure Oura module inside MagicMirror² `config.js` as described below.

5. Restart MagicMirror².

## Testing

If you want to just do a quick test to see if your token setup is working, you can use the command below at the command line, from the MMM-Oura2 directory.  `oura_data.js` effectively replaces the old Python script and allows you to query your data directly.<br/>
`node oura_data.js --interval=1 --unit=weeks --activity=all`<br/>
That should dump a week's worth of activity from your Oura data.  If it fails in some way, you'll need to troubleshoot why.  If it works, then you should be good to go.

## Update Instructions

From the MagicMirror\modules\MMM-Oura2\ path:
1. Pull down the latest files from GitHub:<br/>`git pull` 
2. Remove the old npm files:<br/> `rm -rf node_modules package-lock.json`
3. Install new/updated apis:<br />`npm install`

## Using the module

### MagicMirror² Configuration

To use this module, add the following configuration block to the modules array in the `config/config.js` file:
```js
{
    module: 'MMM-Oura2',
    header: "Oura Data",
    position: "top_left",
    config: {
        charts: ["heartrate"],  // Which charts to display; currently one or more of ["sleep", "heartrate", "scores", "activity"];
        unit:  "weeks",         // One of [months, days, weeks]
        interval: 1,            // Integer interval to combine with unit for length of time to get & display data
        ...
        // See below for detailed Configuration Options
    }
},
```

Note that token information is no longer included in the config.js portion; this is now captured elsewhere (See OAuth2 workflow discussed above).

### Configuration Options

| Option                  | Details
|------------------------ |--------------
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

This code is provided free of charge, to be used at your own risk.  It is intended to provide you some control over your own data, to be used in the MagicMirror² framework.

## Privacy Policy:

This is intended to be a local/self-hosted integration for you to access and view your own Oura data.
I do not collect or receive your Oura data.

You must create your own Oura API key to use this module.

## Developer commands
- `node --run lint` - Run linting checks.
- `node --run lint:fix` - Fix automatically fixable linting errors.